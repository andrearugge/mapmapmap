# Plan 03 — Export Pipeline

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the complete export pipeline — `Renderer` interface, `PlaywrightRenderer`, internal render-frame page, pg-boss queue, R2 upload, and two API routes (POST `/api/export`, GET `/api/export/[jobId]`) — so that a user can trigger a render and download a 1080×1920 PNG.

**Architecture:** A POST to `/api/export` creates a `render_jobs` row (pending) and enqueues a pg-boss job payload containing the full render input. The worker process picks up the job, calls `PlaywrightRenderer.render()` which navigates Playwright to an internal `/render-frame` page (protected by a shared secret, renders `<MapStory>` at 1080×1920 with transparent background), screenshots the result, uploads the PNG to Cloudflare R2, and marks the job as done. The client polls GET `/api/export/[jobId]`; when done, the response contains a presigned R2 download URL valid for 2 hours.

**Tech Stack:** Playwright/Chromium (existing devDep, moved to dep), pg-boss (new), `@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner` (new), tsx (new), Next.js App Router (existing), Drizzle ORM (existing), Zod 4 (existing), Vitest (existing).

## Global Constraints

- `<MapStory>` MUST remain a pure function — the render-frame page passes data as props, zero side-effects inside the component.
- Export output: PNG transparent (omitBackground: true), 1080×1920, no overlay if `background.type === 'transparent'` (enforced by `<MapStory>` itself, not the renderer).
- "Powered by Strava" badge is always present in the PNG — it's a frame layer in `<MapStory>`, never removed.
- Strava OAuth scope stays `activity:read` — the export pipeline never reads new Strava data.
- Next.js "vanilla": no Vercel-only features. Route handlers use `NextRequest`/`NextResponse`, no edge runtime.
- pnpm always. Never `npm install` or `yarn`.
- Cache idempotente (§7) is NOT implemented in v1: every export triggers a fresh render. The `inputHash` field is stored but never used for lookup yet.
- The `RENDER_FRAME_SECRET` env var MUST be set; the render-frame page returns 404 without it.
- Worker concurrency = `RENDER_QUEUE_CONCURRENCY` (default 2); matches vCPU count on Hetzner CPX21.

## Dependencies

- **Plan 01** must be complete (Drizzle schema, DB migration infra, Auth.js skeleton, `DATABASE_URL` env).
- **Plan 02** must be complete (`<MapStory>`, `getTemplate()` from registry, `activityDataSchema`, `customizationsSchema`, all fixture types).
- Plan 04 (Strava Auth) is independent and can run in parallel. The export routes check `auth()` for a session; in tests, auth is mocked.

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Modify | `src/lib/db/schema.ts` | Add `renderJobStatusEnum` + `renderJobs` table |
| (auto) | `src/lib/db/migrations/` | Drizzle-generated migration for `render_jobs` |
| Create | `src/lib/render/renderer.ts` | `Renderer` interface + `hashRenderInput()` pure fn |
| Create | `src/lib/render/__tests__/hash-render-input.test.ts` | Determinism unit tests |
| Create | `src/lib/render/encode-render-data.ts` | `encodeRenderData` / `decodeRenderData` (base64url ↔ JSON) |
| Create | `src/lib/render/__tests__/encode-render-data.test.ts` | Roundtrip + malformed-input unit tests |
| Create | `src/app/render-frame/layout.tsx` | Bare HTML layout, no Next.js chrome, transparent background CSS |
| Create | `src/app/render-frame/page.tsx` | Validates secret, decodes data, renders `<MapStory>` |
| Create | `src/lib/render/r2-client.ts` | Lazy singleton AWS S3Client pointed at R2 |
| Create | `src/lib/render/r2-upload.ts` | `uploadPngToR2()` + `getPresignedDownloadUrl()` |
| Create | `src/lib/render/__tests__/r2-upload.test.ts` | Unit tests with mocked S3Client |
| Create | `src/lib/render/playwright-renderer.ts` | `PlaywrightRenderer` implements `Renderer` |
| Create | `src/lib/render/queue.ts` | pg-boss singleton + `RenderJobPayload` type + `RENDER_QUEUE_NAME` |
| Create | `src/lib/render/worker.ts` | `startWorker()`: subscribes to queue, orchestrates render → upload → DB update |
| Create | `src/lib/render/start-worker.ts` | Process entry point (`tsx src/lib/render/start-worker.ts`) |
| Create | `src/app/api/export/route.ts` | POST `/api/export` handler |
| Create | `src/app/api/export/[jobId]/route.ts` | GET `/api/export/[jobId]` handler |
| Create | `src/app/api/export/__tests__/export.test.ts` | Unit tests for both route handlers |
| Modify | `.env.local.example` | Add render + queue env vars |
| Modify | `package.json` | Move playwright to deps, add pg-boss / AWS SDK / tsx, add `worker` script |
| Modify | `docs/wiki/render.md` | Add export pipeline section |
| Create | `docs/adr/003-export-pipeline.md` | ADR: pg-boss over SQS/Redis; Playwright over Satori; presigned URLs |

---

## Task 1: renderJobs Table + Migration

**Files:**
- Modify: `src/lib/db/schema.ts`
- Auto-generate: `src/lib/db/migrations/` (new migration SQL)

**Interfaces:**
- Produces:
  - `renderJobs` table — `import { renderJobs } from '@/lib/db/schema'`
  - `renderJobStatusEnum` type — `import { renderJobStatusEnum } from '@/lib/db/schema'`

- [ ] **Step 1.1: Write failing type-check test**

Create `src/lib/render/__tests__/schema-smoke.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'

describe('renderJobs schema smoke', () => {
  it('exports renderJobs and its columns compile', async () => {
    const { renderJobs } = await import('@/lib/db/schema')
    expect(renderJobs).toBeDefined()
    expect(renderJobs.id).toBeDefined()
    expect(renderJobs.userId).toBeDefined()
    expect(renderJobs.inputHash).toBeDefined()
    expect(renderJobs.status).toBeDefined()
    expect(renderJobs.r2Key).toBeDefined()
    expect(renderJobs.errorMessage).toBeDefined()
    expect(renderJobs.createdAt).toBeDefined()
    expect(renderJobs.updatedAt).toBeDefined()
  })
})
```

- [ ] **Step 1.2: Run test to verify it fails**

```bash
pnpm test:run src/lib/render/__tests__/schema-smoke.test.ts
```

Expected: FAIL — `renderJobs` not yet exported.

- [ ] **Step 1.3: Add renderJobs table to schema**

Open `src/lib/db/schema.ts`. Add `pgEnum` to the existing `drizzle-orm/pg-core` import. Then append the new enum and table after the existing `sessions` table:

```typescript
import {
  pgTable,
  text,
  timestamp,
  integer,
  primaryKey,
  pgEnum,
} from 'drizzle-orm/pg-core'
import type { AdapterAccountType } from 'next-auth/adapters'

// ... existing users / accounts / sessions unchanged ...

export const renderJobStatusEnum = pgEnum('render_job_status', [
  'pending',
  'processing',
  'done',
  'failed',
])

export const renderJobs = pgTable('render_jobs', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  inputHash: text('input_hash').notNull(),
  status: renderJobStatusEnum('status').notNull().default('pending'),
  r2Key: text('r2_key'),
  errorMessage: text('error_message'),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
})
```

- [ ] **Step 1.4: Run test to verify it passes**

```bash
pnpm test:run src/lib/render/__tests__/schema-smoke.test.ts
```

Expected: PASS.

- [ ] **Step 1.5: Generate migration**

```bash
pnpm db:generate
```

Expected: new file created under `src/lib/db/migrations/`. Verify it contains `CREATE TYPE "render_job_status"` and `CREATE TABLE "render_jobs"`.

- [ ] **Step 1.6: Run migration against local DB**

```bash
pnpm db:migrate
```

Expected: migration applied, no errors. (Requires local Docker Compose DB running on port 5433.)

- [ ] **Step 1.7: Type-check**

```bash
pnpm type-check
```

Expected: 0 errors.

- [ ] **Step 1.8: Commit**

```bash
git add src/lib/db/schema.ts src/lib/db/migrations/ src/lib/render/__tests__/schema-smoke.test.ts
git commit -m "feat: add render_jobs table with status enum"
```

---

## Task 2: Renderer Interface + Hash Function

**Files:**
- Create: `src/lib/render/renderer.ts`
- Create: `src/lib/render/__tests__/hash-render-input.test.ts`

**Interfaces:**
- Produces:
  - `Renderer` interface — `import type { Renderer } from '@/lib/render/renderer'`
  - `hashRenderInput(input: { templateId: string; activity: ActivityData; customizations: Customizations }): string`

- [ ] **Step 2.1: Write failing tests**

Create `src/lib/render/__tests__/hash-render-input.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { hashRenderInput } from '@/lib/render/renderer'
import { longTrailFixture } from '@/lib/art/fixtures'

const baseCustomizations = {
  primary: '#ffffff',
  accent: '#000000',
  background: { type: 'transparent' as const },
  artPosition: 'middle-center' as const,
}

describe('hashRenderInput', () => {
  it('returns a 64-char hex string', () => {
    const hash = hashRenderInput({
      templateId: 'minimal-arc',
      activity: longTrailFixture,
      customizations: baseCustomizations,
    })
    expect(hash).toMatch(/^[a-f0-9]{64}$/)
  })

  it('is deterministic — same input produces same hash', () => {
    const input = { templateId: 'minimal-arc', activity: longTrailFixture, customizations: baseCustomizations }
    expect(hashRenderInput(input)).toBe(hashRenderInput(input))
  })

  it('changes when templateId changes', () => {
    const a = hashRenderInput({ templateId: 'minimal-arc', activity: longTrailFixture, customizations: baseCustomizations })
    const b = hashRenderInput({ templateId: 'other-art', activity: longTrailFixture, customizations: baseCustomizations })
    expect(a).not.toBe(b)
  })

  it('changes when customizations change', () => {
    const a = hashRenderInput({ templateId: 'minimal-arc', activity: longTrailFixture, customizations: baseCustomizations })
    const b = hashRenderInput({
      templateId: 'minimal-arc',
      activity: longTrailFixture,
      customizations: { ...baseCustomizations, primary: '#ff0000' },
    })
    expect(a).not.toBe(b)
  })
})
```

- [ ] **Step 2.2: Run tests to verify they fail**

```bash
pnpm test:run src/lib/render/__tests__/hash-render-input.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 2.3: Create `src/lib/render/renderer.ts`**

```typescript
import { createHash } from 'node:crypto'
import type { Template, ActivityData, Customizations } from '@/types/map-story'

export interface Renderer {
  render(input: {
    template: Template
    activity: ActivityData
    customizations: Customizations
  }): Promise<{ png: Buffer; cacheKey: string }>
}

export function hashRenderInput(input: {
  templateId: string
  activity: ActivityData
  customizations: Customizations
}): string {
  const canonical = JSON.stringify({
    templateId: input.templateId,
    activity: input.activity,
    customizations: input.customizations,
  })
  return createHash('sha256').update(canonical).digest('hex')
}
```

- [ ] **Step 2.4: Run tests to verify they pass**

```bash
pnpm test:run src/lib/render/__tests__/hash-render-input.test.ts
```

Expected: PASS (4 tests).

- [ ] **Step 2.5: Type-check**

```bash
pnpm type-check
```

Expected: 0 errors.

- [ ] **Step 2.6: Commit**

```bash
git add src/lib/render/renderer.ts src/lib/render/__tests__/hash-render-input.test.ts
git commit -m "feat: add Renderer interface and hashRenderInput"
```

---

## Task 3: Encode/Decode Render Data

**Files:**
- Create: `src/lib/render/encode-render-data.ts`
- Create: `src/lib/render/__tests__/encode-render-data.test.ts`

**Interfaces:**
- Consumes: `activityDataSchema` from `@/lib/schemas/activity`, `customizationsSchema` from `@/lib/schemas/customizations`
- Produces:
  - `RenderData` type — `import type { RenderData } from '@/lib/render/encode-render-data'`
  - `encodeRenderData(data: RenderData): string`
  - `decodeRenderData(encoded: string): RenderData | null`

- [ ] **Step 3.1: Write failing tests**

Create `src/lib/render/__tests__/encode-render-data.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { encodeRenderData, decodeRenderData } from '@/lib/render/encode-render-data'
import { longTrailFixture } from '@/lib/art/fixtures'
import type { RenderData } from '@/lib/render/encode-render-data'

const sample: RenderData = {
  templateId: 'minimal-arc',
  activity: longTrailFixture,
  customizations: {
    primary: '#ffffff',
    accent: '#ff5500',
    background: { type: 'transparent' },
    artPosition: 'middle-center',
  },
}

describe('encodeRenderData / decodeRenderData', () => {
  it('roundtrip: decode(encode(x)) deep-equals x', () => {
    const encoded = encodeRenderData(sample)
    const decoded = decodeRenderData(encoded)
    expect(decoded).toEqual(sample)
  })

  it('encoded string contains no whitespace', () => {
    const encoded = encodeRenderData(sample)
    expect(encoded).not.toMatch(/\s/)
  })

  it('decodeRenderData returns null for empty string', () => {
    expect(decodeRenderData('')).toBeNull()
  })

  it('decodeRenderData returns null for invalid base64', () => {
    expect(decodeRenderData('!!!not-base64!!!')).toBeNull()
  })

  it('decodeRenderData returns null for valid base64 but invalid schema', () => {
    const bad = Buffer.from(JSON.stringify({ foo: 'bar' })).toString('base64url')
    expect(decodeRenderData(bad)).toBeNull()
  })
})
```

- [ ] **Step 3.2: Run tests to verify they fail**

```bash
pnpm test:run src/lib/render/__tests__/encode-render-data.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3.3: Create `src/lib/render/encode-render-data.ts`**

```typescript
import { z } from 'zod'
import { activityDataSchema } from '@/lib/schemas/activity'
import { customizationsSchema } from '@/lib/schemas/customizations'

const renderDataSchema = z.object({
  templateId: z.string().min(1),
  activity: activityDataSchema,
  customizations: customizationsSchema,
})

export type RenderData = z.infer<typeof renderDataSchema>

export function encodeRenderData(data: RenderData): string {
  const json = JSON.stringify(data)
  return Buffer.from(json, 'utf8').toString('base64url')
}

export function decodeRenderData(encoded: string): RenderData | null {
  try {
    const json = Buffer.from(encoded, 'base64url').toString('utf8')
    const parsed: unknown = JSON.parse(json)
    const result = renderDataSchema.safeParse(parsed)
    return result.success ? result.data : null
  } catch {
    return null
  }
}
```

- [ ] **Step 3.4: Run tests to verify they pass**

```bash
pnpm test:run src/lib/render/__tests__/encode-render-data.test.ts
```

Expected: PASS (5 tests).

- [ ] **Step 3.5: Type-check**

```bash
pnpm type-check
```

Expected: 0 errors.

- [ ] **Step 3.6: Commit**

```bash
git add src/lib/render/encode-render-data.ts src/lib/render/__tests__/encode-render-data.test.ts
git commit -m "feat: add encodeRenderData / decodeRenderData utilities"
```

---

## Task 4: Render Frame Page (Internal Route)

**Files:**
- Create: `src/app/render-frame/layout.tsx`
- Create: `src/app/render-frame/page.tsx`

**Interfaces:**
- Consumes: `decodeRenderData` from `@/lib/render/encode-render-data`, `getTemplate` from `@/lib/art/registry`, `MapStory` from `@/components/art/MapStory`
- Produces: internal HTTP route `GET /render-frame?secret=<secret>&data=<encoded>` → renders `<MapStory>` at 1080×1920 with transparent background

**Security model:** Route returns 404 unless `?secret` matches `process.env.RENDER_FRAME_SECRET`. This keeps the route internal (the secret is only known to the worker on the same box). Set this env var in production before running the worker.

- [ ] **Step 4.1: Write failing test**

Create `src/app/render-frame/__tests__/page.test.tsx`:

```typescript
import { describe, it, expect, vi } from 'vitest'
import { decodeRenderData, encodeRenderData } from '@/lib/render/encode-render-data'
import { longTrailFixture } from '@/lib/art/fixtures'

// We test the encode/decode behavior that the page depends on.
// The page itself is a Server Component; visual correctness is verified via Storybook + manual run.
describe('render-frame page inputs', () => {
  it('encodes and decodes a valid render payload', () => {
    const data = {
      templateId: 'minimal-arc',
      activity: longTrailFixture,
      customizations: {
        primary: '#ffffff',
        accent: '#ff5500',
        background: { type: 'transparent' as const },
        artPosition: 'middle-center' as const,
      },
    }
    const encoded = encodeRenderData(data)
    expect(decodeRenderData(encoded)).toEqual(data)
  })

  it('decodeRenderData returns null for a tampered token', () => {
    const data = {
      templateId: 'minimal-arc',
      activity: longTrailFixture,
      customizations: {
        primary: '#ffffff',
        accent: '#ff5500',
        background: { type: 'transparent' as const },
        artPosition: 'middle-center' as const,
      },
    }
    const encoded = encodeRenderData(data)
    const tampered = encoded.slice(0, -4) + 'AAAA'
    expect(decodeRenderData(tampered)).toBeNull()
  })
})
```

- [ ] **Step 4.2: Run tests to verify they pass (already covered by Task 3)**

```bash
pnpm test:run src/app/render-frame/__tests__/page.test.tsx
```

Expected: PASS (these tests depend on Task 3 utilities already implemented).

- [ ] **Step 4.3: Create `src/app/render-frame/layout.tsx`**

This layout replaces the root `app/layout.tsx` for the render-frame route. It strips all app chrome and forces transparent background.

```tsx
import type { Metadata } from 'next'

export const metadata: Metadata = { robots: 'noindex' }

export default function RenderFrameLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html>
      <head>
        <style>{`
          * { margin: 0; padding: 0; box-sizing: border-box; }
          html, body { background: transparent; overflow: hidden; }
        `}</style>
      </head>
      <body>{children}</body>
    </html>
  )
}
```

- [ ] **Step 4.4: Create `src/app/render-frame/page.tsx`**

```tsx
import { notFound } from 'next/navigation'
import { decodeRenderData } from '@/lib/render/encode-render-data'
import { getTemplate } from '@/lib/art/registry'
import { MapStory } from '@/components/art/MapStory'

interface Props {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function RenderFramePage({ searchParams }: Props) {
  const params = await searchParams

  const secret = process.env.RENDER_FRAME_SECRET
  if (!secret || params.secret !== secret) {
    notFound()
  }

  const encoded = params.data
  if (typeof encoded !== 'string') notFound()

  const renderData = decodeRenderData(encoded)
  if (!renderData) notFound()

  const template = getTemplate(renderData.templateId)
  if (!template) notFound()

  return (
    <div
      style={{
        width: 1080,
        height: 1920,
        position: 'relative',
        overflow: 'hidden',
        background: 'transparent',
      }}
    >
      <MapStory
        template={template}
        activity={renderData.activity}
        customizations={renderData.customizations}
      />
    </div>
  )
}
```

- [ ] **Step 4.5: Add RENDER_FRAME_SECRET to .env.local.example**

Open `.env.local.example` and append:

```
# Render pipeline
# Generate: openssl rand -hex 32
RENDER_FRAME_SECRET=""
RENDER_WORKER_BASE_URL="http://localhost:3000"
RENDER_QUEUE_CONCURRENCY="2"
```

- [ ] **Step 4.6: Add RENDER_FRAME_SECRET to your local .env.local**

Generate a secret and add to `.env.local`:

```bash
echo "RENDER_FRAME_SECRET=$(openssl rand -hex 32)"
```

Copy the output value into `.env.local`.

- [ ] **Step 4.7: Type-check**

```bash
pnpm type-check
```

Expected: 0 errors.

- [ ] **Step 4.8: Manual smoke test — render-frame in browser**

Start the dev server (`pnpm dev`), then in a separate terminal:

```bash
node -e "
const { encodeRenderData } = await import('./src/lib/render/encode-render-data.ts')
// use tsx or adjust to match your local setup
"
```

Actually: use the REPL-style approach below. First get the RENDER_FRAME_SECRET from `.env.local`, then build the URL manually:

1. Run `pnpm dev`
2. Open `src/lib/render/__tests__/encode-render-data.test.ts` — copy the `encodeRenderData(sample)` result by running `pnpm test:run` with `console.log(encodeRenderData(sample))` added temporarily.
3. Navigate to `http://localhost:3000/render-frame?secret=<YOUR_SECRET>&data=<encoded>` in the browser.
4. You should see the `<MapStory>` component rendered at 1080×1920 with no page chrome.

Expected: white page with the MapStory layout — route map + stats + Strava attribution.

- [ ] **Step 4.9: Commit**

```bash
git add src/app/render-frame/ src/lib/render/__tests__/ .env.local.example
git commit -m "feat: add internal render-frame page for Playwright screenshot"
```

---

## Task 5: R2 Client + Upload Utilities

**Files:**
- Modify: `package.json` (add `@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner`)
- Create: `src/lib/render/r2-client.ts`
- Create: `src/lib/render/r2-upload.ts`
- Create: `src/lib/render/__tests__/r2-upload.test.ts`

**Interfaces:**
- Produces:
  - `getR2Client(): S3Client`
  - `uploadPngToR2(key: string, buffer: Buffer): Promise<void>`
  - `getPresignedDownloadUrl(key: string, ttlSeconds?: number): Promise<string>`

- [ ] **Step 5.1: Write failing tests**

Create `src/lib/render/__tests__/r2-upload.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@aws-sdk/client-s3', () => ({
  S3Client: vi.fn().mockImplementation(() => ({
    send: vi.fn().mockResolvedValue({}),
  })),
  PutObjectCommand: vi.fn().mockImplementation((input) => ({ input })),
  GetObjectCommand: vi.fn().mockImplementation((input) => ({ input })),
}))

vi.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: vi.fn().mockResolvedValue('https://r2.example.com/exports/test.png?X-Amz-Signature=abc'),
}))

describe('r2-upload', () => {
  beforeEach(() => {
    vi.resetModules()
    process.env.R2_ACCOUNT_ID = 'test-account'
    process.env.R2_ACCESS_KEY_ID = 'test-key-id'
    process.env.R2_SECRET_ACCESS_KEY = 'test-secret'
    process.env.R2_BUCKET_NAME = 'test-bucket'
  })

  it('uploadPngToR2 sends PutObjectCommand with correct content-type', async () => {
    const { uploadPngToR2 } = await import('@/lib/render/r2-upload')
    const { PutObjectCommand } = await import('@aws-sdk/client-s3')
    const buffer = Buffer.from('fake-png-data')
    await uploadPngToR2('exports/test-job.png', buffer)
    expect(PutObjectCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        Key: 'exports/test-job.png',
        ContentType: 'image/png',
      })
    )
  })

  it('getPresignedDownloadUrl returns a URL string', async () => {
    const { getPresignedDownloadUrl } = await import('@/lib/render/r2-upload')
    const url = await getPresignedDownloadUrl('exports/test-job.png', 7200)
    expect(url).toMatch(/^https?:\/\//)
  })

  it('getPresignedDownloadUrl defaults to 7200s TTL', async () => {
    const { getPresignedDownloadUrl } = await import('@/lib/render/r2-upload')
    const { getSignedUrl } = await import('@aws-sdk/s3-request-presigner')
    await getPresignedDownloadUrl('exports/test-job.png')
    expect(getSignedUrl).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      { expiresIn: 7200 }
    )
  })
})
```

- [ ] **Step 5.2: Run tests to verify they fail**

```bash
pnpm test:run src/lib/render/__tests__/r2-upload.test.ts
```

Expected: FAIL — modules not found.

- [ ] **Step 5.3: Install AWS SDK packages**

```bash
pnpm add @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
```

- [ ] **Step 5.4: Create `src/lib/render/r2-client.ts`**

```typescript
import { S3Client } from '@aws-sdk/client-s3'

let _r2Client: S3Client | null = null

export function getR2Client(): S3Client {
  if (_r2Client) return _r2Client

  const accountId = process.env.R2_ACCOUNT_ID
  const accessKeyId = process.env.R2_ACCESS_KEY_ID
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY

  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error('R2 credentials not configured (R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY)')
  }

  _r2Client = new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  })
  return _r2Client
}
```

- [ ] **Step 5.5: Create `src/lib/render/r2-upload.ts`**

```typescript
import { PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { getR2Client } from './r2-client'

function getBucket(): string {
  const name = process.env.R2_BUCKET_NAME
  if (!name) throw new Error('R2_BUCKET_NAME not configured')
  return name
}

export async function uploadPngToR2(key: string, buffer: Buffer): Promise<void> {
  const client = getR2Client()
  await client.send(
    new PutObjectCommand({
      Bucket: getBucket(),
      Key: key,
      Body: buffer,
      ContentType: 'image/png',
    })
  )
}

export async function getPresignedDownloadUrl(
  key: string,
  ttlSeconds = 7200,
): Promise<string> {
  const client = getR2Client()
  const command = new GetObjectCommand({ Bucket: getBucket(), Key: key })
  return getSignedUrl(client, command, { expiresIn: ttlSeconds })
}
```

- [ ] **Step 5.6: Run tests to verify they pass**

```bash
pnpm test:run src/lib/render/__tests__/r2-upload.test.ts
```

Expected: PASS (3 tests).

- [ ] **Step 5.7: Type-check**

```bash
pnpm type-check
```

Expected: 0 errors.

- [ ] **Step 5.8: Commit**

```bash
git add src/lib/render/r2-client.ts src/lib/render/r2-upload.ts src/lib/render/__tests__/r2-upload.test.ts package.json pnpm-lock.yaml
git commit -m "feat: add R2 client and upload utilities"
```

---

## Task 6: PlaywrightRenderer

**Files:**
- Modify: `package.json` (move `playwright` from devDependencies to dependencies)
- Create: `src/lib/render/playwright-renderer.ts`

**Interfaces:**
- Consumes: `Renderer` interface from `@/lib/render/renderer`, `hashRenderInput` from `@/lib/render/renderer`, `encodeRenderData` from `@/lib/render/encode-render-data`
- Produces: `PlaywrightRenderer` class implementing `Renderer`

**Testing note:** `PlaywrightRenderer` requires a running Next.js server and a real Chromium binary. Its unit-level behaviour (URL construction, cacheKey) is verified by Tasks 2 and 3 tests. Full integration (actual PNG) is a manual step below.

- [ ] **Step 6.1: Move playwright to dependencies**

In `package.json`, move `"playwright": "^1.61.1"` from `devDependencies` to `dependencies`. Then re-install:

```bash
pnpm install
```

Expected: `pnpm-lock.yaml` updated, `playwright` now listed under `dependencies`.

- [ ] **Step 6.2: Create `src/lib/render/playwright-renderer.ts`**

```typescript
import { chromium } from 'playwright'
import type { Template, ActivityData, Customizations } from '@/types/map-story'
import type { Renderer } from './renderer'
import { hashRenderInput } from './renderer'
import { encodeRenderData } from './encode-render-data'

// v1: launch a browser per render (acceptable for queue-limited concurrency).
// Future: keep browser alive and reuse pages across renders.
export class PlaywrightRenderer implements Renderer {
  async render(input: {
    template: Template
    activity: ActivityData
    customizations: Customizations
  }): Promise<{ png: Buffer; cacheKey: string }> {
    const secret = process.env.RENDER_FRAME_SECRET
    if (!secret) throw new Error('RENDER_FRAME_SECRET not configured')

    const baseUrl = process.env.RENDER_WORKER_BASE_URL ?? 'http://localhost:3000'

    const cacheKey = hashRenderInput({
      templateId: input.template.id,
      activity: input.activity,
      customizations: input.customizations,
    })

    const encoded = encodeRenderData({
      templateId: input.template.id,
      activity: input.activity,
      customizations: input.customizations,
    })

    const url =
      `${baseUrl}/render-frame` +
      `?secret=${encodeURIComponent(secret)}` +
      `&data=${encoded}`

    const browser = await chromium.launch({ headless: true })
    try {
      const page = await browser.newPage()
      await page.setViewportSize({ width: 1080, height: 1920 })
      await page.goto(url, { waitUntil: 'networkidle' })

      const pngUint8 = await page.screenshot({
        type: 'png',
        omitBackground: true,
        clip: { x: 0, y: 0, width: 1080, height: 1920 },
      })

      return { png: Buffer.from(pngUint8), cacheKey }
    } finally {
      await browser.close()
    }
  }
}
```

- [ ] **Step 6.3: Type-check**

```bash
pnpm type-check
```

Expected: 0 errors.

- [ ] **Step 6.4: Manual integration test**

Requires: local dev server running (`pnpm dev`) + `RENDER_FRAME_SECRET` set in `.env.local`.

Create a one-off test script at `scripts/test-render.ts`:

```typescript
import { PlaywrightRenderer } from '../src/lib/render/playwright-renderer'
import { minimalArcTemplate } from '../src/lib/art/arts/minimal-arc/index'
import { longTrailFixture } from '../src/lib/art/fixtures'
import { writeFileSync } from 'node:fs'

const renderer = new PlaywrightRenderer()
const { png, cacheKey } = await renderer.render({
  template: minimalArcTemplate,
  activity: longTrailFixture,
  customizations: {
    primary: '#ffffff',
    accent: '#ff5500',
    background: { type: 'transparent' },
    artPosition: 'middle-center',
  },
})

writeFileSync('/tmp/test-render.png', png)
console.log('PNG written to /tmp/test-render.png')
console.log('cacheKey:', cacheKey)
```

Run it (requires tsx):

```bash
RENDER_FRAME_SECRET=$(grep RENDER_FRAME_SECRET .env.local | cut -d= -f2 | tr -d '"') \
RENDER_WORKER_BASE_URL=http://localhost:3000 \
tsx scripts/test-render.ts
```

Expected: `/tmp/test-render.png` is created, ~1–3 seconds to run. Open the PNG to confirm it shows the route + stats + Strava attribution at 1080×1920.

Delete the script after verification:

```bash
rm scripts/test-render.ts
```

- [ ] **Step 6.5: Commit**

```bash
git add src/lib/render/playwright-renderer.ts package.json pnpm-lock.yaml
git commit -m "feat: add PlaywrightRenderer (Playwright/Chromium screenshot at 1080x1920)"
```

---

## Task 7: pg-boss Queue + Worker

**Files:**
- Modify: `package.json` (add `pg-boss`, `tsx`)
- Create: `src/lib/render/queue.ts`
- Create: `src/lib/render/worker.ts`
- Create: `src/lib/render/start-worker.ts`

**Interfaces:**
- Consumes: `db` from `@/lib/db`, `renderJobs` from `@/lib/db/schema`, `PlaywrightRenderer`, `uploadPngToR2`, `getTemplate`
- Produces:
  - `RENDER_QUEUE_NAME: 'render'`
  - `RenderJobPayload` type
  - `getQueue(): Promise<PgBoss>`
  - `startWorker(): Promise<void>`
  - CLI entry: `src/lib/render/start-worker.ts`

- [ ] **Step 7.1: Install pg-boss and tsx**

```bash
pnpm add pg-boss tsx
pnpm add -D @types/pg-boss
```

- [ ] **Step 7.2: Write failing test**

Create `src/lib/render/__tests__/worker-smoke.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'

describe('queue exports', () => {
  it('RENDER_QUEUE_NAME is the string "render"', async () => {
    const { RENDER_QUEUE_NAME } = await import('@/lib/render/queue')
    expect(RENDER_QUEUE_NAME).toBe('render')
  })
})
```

- [ ] **Step 7.3: Run test to verify it fails**

```bash
pnpm test:run src/lib/render/__tests__/worker-smoke.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 7.4: Create `src/lib/render/queue.ts`**

```typescript
import PgBoss from 'pg-boss'
import type { ActivityData, Customizations } from '@/types/map-story'

export const RENDER_QUEUE_NAME = 'render' as const

export interface RenderJobPayload {
  jobId: string
  templateId: string
  activity: ActivityData
  customizations: Customizations
}

let _boss: PgBoss | null = null

export async function getQueue(): Promise<PgBoss> {
  if (_boss) return _boss

  const dbUrl = process.env.DATABASE_URL
  if (!dbUrl) throw new Error('DATABASE_URL not configured')

  _boss = new PgBoss(dbUrl)
  await _boss.start()
  return _boss
}
```

- [ ] **Step 7.5: Create `src/lib/render/worker.ts`**

```typescript
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { renderJobs } from '@/lib/db/schema'
import { getTemplate } from '@/lib/art/registry'
import { PlaywrightRenderer } from './playwright-renderer'
import { uploadPngToR2 } from './r2-upload'
import { getQueue, RENDER_QUEUE_NAME } from './queue'
import type { RenderJobPayload } from './queue'

export async function startWorker(): Promise<void> {
  const concurrency = Number(process.env.RENDER_QUEUE_CONCURRENCY ?? 2)
  const queue = await getQueue()
  const renderer = new PlaywrightRenderer()

  await queue.work<RenderJobPayload>(
    RENDER_QUEUE_NAME,
    { teamSize: concurrency, teamConcurrency: concurrency },
    async (job) => {
      const { jobId, templateId, activity, customizations } = job.data

      await db
        .update(renderJobs)
        .set({ status: 'processing', updatedAt: new Date() })
        .where(eq(renderJobs.id, jobId))

      try {
        const template = getTemplate(templateId)
        if (!template) throw new Error(`Template not found: ${templateId}`)

        const { png } = await renderer.render({ template, activity, customizations })

        const r2Key = `exports/${jobId}.png`
        await uploadPngToR2(r2Key, png)

        await db
          .update(renderJobs)
          .set({ status: 'done', r2Key, updatedAt: new Date() })
          .where(eq(renderJobs.id, jobId))
      } catch (err) {
        await db
          .update(renderJobs)
          .set({
            status: 'failed',
            errorMessage: err instanceof Error ? err.message : String(err),
            updatedAt: new Date(),
          })
          .where(eq(renderJobs.id, jobId))

        // Re-throw so pg-boss records the failure and applies its retry policy.
        throw err
      }
    },
  )

  console.log(`Render worker started (concurrency: ${concurrency})`)
}
```

- [ ] **Step 7.6: Create `src/lib/render/start-worker.ts`**

```typescript
import { startWorker } from './worker'

startWorker().catch((err) => {
  console.error('Render worker failed to start:', err)
  process.exit(1)
})
```

- [ ] **Step 7.7: Add `worker` script to package.json**

In `package.json`, inside `"scripts"`, add:

```json
"worker": "tsx src/lib/render/start-worker.ts"
```

- [ ] **Step 7.8: Run test to verify it passes**

```bash
pnpm test:run src/lib/render/__tests__/worker-smoke.test.ts
```

Expected: PASS (1 test).

- [ ] **Step 7.9: Type-check**

```bash
pnpm type-check
```

Expected: 0 errors.

- [ ] **Step 7.10: Commit**

```bash
git add src/lib/render/queue.ts src/lib/render/worker.ts src/lib/render/start-worker.ts \
       src/lib/render/__tests__/worker-smoke.test.ts \
       package.json pnpm-lock.yaml
git commit -m "feat: add pg-boss queue, render worker, and worker entry point"
```

---

## Task 8: Export API Routes

**Files:**
- Create: `src/app/api/export/route.ts`
- Create: `src/app/api/export/[jobId]/route.ts`
- Create: `src/app/api/export/__tests__/export.test.ts`

**Interfaces:**
- Consumes: `auth` from `@/auth`, `db` from `@/lib/db`, `renderJobs` from `@/lib/db/schema`, `hashRenderInput` from `@/lib/render/renderer`, `getQueue` / `RENDER_QUEUE_NAME` / `RenderJobPayload` from `@/lib/render/queue`, `getPresignedDownloadUrl` from `@/lib/render/r2-upload`, `activityDataSchema`, `customizationsSchema`
- Produces:
  - `POST /api/export` → `{ jobId: string }` (202) | `{ error }` (400/401)
  - `GET /api/export/:jobId` → `{ status: 'pending'|'processing' }` | `{ status: 'done', downloadUrl: string }` | `{ status: 'failed', error: string }` | 404

- [ ] **Step 8.1: Write failing tests**

Create `src/app/api/export/__tests__/export.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// Mock auth
vi.mock('@/auth', () => ({
  auth: vi.fn(),
}))

// Mock db
vi.mock('@/lib/db', () => ({
  db: {
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{ id: 'test-job-uuid' }]),
      }),
    }),
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([]),
        }),
      }),
    }),
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      }),
    }),
  },
}))

// Mock queue
vi.mock('@/lib/render/queue', () => ({
  getQueue: vi.fn().mockResolvedValue({
    send: vi.fn().mockResolvedValue('pg-boss-id'),
  }),
  RENDER_QUEUE_NAME: 'render',
}))

// Mock R2
vi.mock('@/lib/render/r2-upload', () => ({
  getPresignedDownloadUrl: vi.fn().mockResolvedValue('https://r2.example.com/exports/test-job-uuid.png?X-Amz-Signature=abc'),
}))

import { auth } from '@/auth'

const mockAuth = vi.mocked(auth)

const validBody = {
  templateId: 'minimal-arc',
  activity: {
    id: 'act-1',
    type: 'run',
    name: 'Morning run',
    date: '2024-01-15T08:00:00Z',
    stats: {
      distance_m: 10000,
      movingTime_s: 3600,
      elapsedTime_s: 3700,
      elevationGain_m: 150,
      avgSpeed_mps: 2.78,
    },
    route: { points: [[0.5, 0.5]] as [number, number][], hasGps: true },
    athlete: { name: 'Test User' },
  },
  customizations: {
    primary: '#ffffff',
    accent: '#ff5500',
    background: { type: 'transparent' },
    artPosition: 'middle-center',
  },
}

describe('POST /api/export', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 when not authenticated', async () => {
    mockAuth.mockResolvedValue(null)
    const { POST } = await import('@/app/api/export/route')
    const req = new NextRequest('http://localhost/api/export', {
      method: 'POST',
      body: JSON.stringify(validBody),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    expect(res.status).toBe(401)
  })

  it('returns 400 for invalid body', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'user-1' } } as ReturnType<typeof auth> extends Promise<infer T> ? T : never)
    const { POST } = await import('@/app/api/export/route')
    const req = new NextRequest('http://localhost/api/export', {
      method: 'POST',
      body: JSON.stringify({ templateId: 'minimal-arc' }), // missing activity and customizations
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('returns 202 with jobId for valid request', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'user-1' } } as ReturnType<typeof auth> extends Promise<infer T> ? T : never)
    const { POST } = await import('@/app/api/export/route')
    const req = new NextRequest('http://localhost/api/export', {
      method: 'POST',
      body: JSON.stringify(validBody),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    expect(res.status).toBe(202)
    const body = await res.json()
    expect(body).toHaveProperty('jobId', 'test-job-uuid')
  })
})

describe('GET /api/export/[jobId]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 when not authenticated', async () => {
    mockAuth.mockResolvedValue(null)
    const { GET } = await import('@/app/api/export/[jobId]/route')
    const req = new NextRequest('http://localhost/api/export/test-job-uuid')
    const res = await GET(req, { params: Promise.resolve({ jobId: 'test-job-uuid' }) })
    expect(res.status).toBe(401)
  })

  it('returns 404 when job not found', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'user-1' } } as ReturnType<typeof auth> extends Promise<infer T> ? T : never)
    const { db } = await import('@/lib/db')
    vi.mocked(db.select).mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([]),
        }),
      }),
    } as ReturnType<typeof db.select>)

    const { GET } = await import('@/app/api/export/[jobId]/route')
    const req = new NextRequest('http://localhost/api/export/missing-id')
    const res = await GET(req, { params: Promise.resolve({ jobId: 'missing-id' }) })
    expect(res.status).toBe(404)
  })

  it('returns { status: "pending" } for pending job', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'user-1' } } as ReturnType<typeof auth> extends Promise<infer T> ? T : never)
    const { db } = await import('@/lib/db')
    vi.mocked(db.select).mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([{
            id: 'test-job-uuid', userId: 'user-1', status: 'pending',
            r2Key: null, errorMessage: null,
          }]),
        }),
      }),
    } as ReturnType<typeof db.select>)

    const { GET } = await import('@/app/api/export/[jobId]/route')
    const req = new NextRequest('http://localhost/api/export/test-job-uuid')
    const res = await GET(req, { params: Promise.resolve({ jobId: 'test-job-uuid' }) })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual({ status: 'pending' })
  })

  it('returns { status: "done", downloadUrl } for completed job', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'user-1' } } as ReturnType<typeof auth> extends Promise<infer T> ? T : never)
    const { db } = await import('@/lib/db')
    vi.mocked(db.select).mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([{
            id: 'test-job-uuid', userId: 'user-1', status: 'done',
            r2Key: 'exports/test-job-uuid.png', errorMessage: null,
          }]),
        }),
      }),
    } as ReturnType<typeof db.select>)

    const { GET } = await import('@/app/api/export/[jobId]/route')
    const req = new NextRequest('http://localhost/api/export/test-job-uuid')
    const res = await GET(req, { params: Promise.resolve({ jobId: 'test-job-uuid' }) })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.status).toBe('done')
    expect(body.downloadUrl).toMatch(/^https?:\/\//)
  })
})
```

- [ ] **Step 8.2: Run tests to verify they fail**

```bash
pnpm test:run src/app/api/export/__tests__/export.test.ts
```

Expected: FAIL — route modules not found.

- [ ] **Step 8.3: Create `src/app/api/export/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { renderJobs } from '@/lib/db/schema'
import { activityDataSchema } from '@/lib/schemas/activity'
import { customizationsSchema } from '@/lib/schemas/customizations'
import { hashRenderInput } from '@/lib/render/renderer'
import { getQueue, RENDER_QUEUE_NAME } from '@/lib/render/queue'
import type { RenderJobPayload } from '@/lib/render/queue'
import { auth } from '@/auth'

const exportRequestSchema = z.object({
  templateId: z.string().min(1),
  activity: activityDataSchema,
  customizations: customizationsSchema,
})

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = exportRequestSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request', details: parsed.error.flatten() },
      { status: 400 },
    )
  }

  const { templateId, activity, customizations } = parsed.data
  const inputHash = hashRenderInput({ templateId, activity, customizations })

  const [job] = await db
    .insert(renderJobs)
    .values({ userId: session.user.id, inputHash, status: 'pending' })
    .returning({ id: renderJobs.id })

  const payload: RenderJobPayload = { jobId: job.id, templateId, activity, customizations }
  const queue = await getQueue()
  await queue.send(RENDER_QUEUE_NAME, payload)

  return NextResponse.json({ jobId: job.id }, { status: 202 })
}
```

- [ ] **Step 8.4: Create `src/app/api/export/[jobId]/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { renderJobs } from '@/lib/db/schema'
import { getPresignedDownloadUrl } from '@/lib/render/r2-upload'
import { auth } from '@/auth'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> },
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { jobId } = await params

  const [job] = await db
    .select()
    .from(renderJobs)
    .where(eq(renderJobs.id, jobId))
    .limit(1)

  if (!job || job.userId !== session.user.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  if (job.status === 'done' && job.r2Key) {
    const downloadUrl = await getPresignedDownloadUrl(job.r2Key, 7200)
    return NextResponse.json({ status: 'done', downloadUrl })
  }

  if (job.status === 'failed') {
    return NextResponse.json({
      status: 'failed',
      error: job.errorMessage ?? 'Render failed',
    })
  }

  return NextResponse.json({ status: job.status })
}
```

- [ ] **Step 8.5: Run tests to verify they pass**

```bash
pnpm test:run src/app/api/export/__tests__/export.test.ts
```

Expected: PASS (7 tests).

- [ ] **Step 8.6: Run full test suite**

```bash
pnpm test:run
```

Expected: all tests pass (22 existing + new Plan 03 tests).

- [ ] **Step 8.7: Type-check + lint**

```bash
pnpm type-check && pnpm lint
```

Expected: 0 errors.

- [ ] **Step 8.8: Commit**

```bash
git add src/app/api/export/ src/app/api/export/__tests__/
git commit -m "feat: add export API routes (POST /api/export, GET /api/export/:jobId)"
```

---

## Task 9: Worker Script, Package Scripts, Env Docs + ADR

**Files:**
- Modify: `.env.local.example` (verify all render vars present — done in Task 4, but confirm)
- Modify: `docs/wiki/render.md` (add export pipeline section)
- Create: `docs/adr/003-export-pipeline.md`

- [ ] **Step 9.1: Verify .env.local.example is complete**

Open `.env.local.example` and confirm it contains all of these:

```
RENDER_FRAME_SECRET=""
RENDER_WORKER_BASE_URL="http://localhost:3000"
RENDER_QUEUE_CONCURRENCY="2"
R2_ACCOUNT_ID=""
R2_ACCESS_KEY_ID=""
R2_SECRET_ACCESS_KEY=""
R2_BUCKET_NAME="mapmapmap-exports"
```

If any are missing, add them now.

- [ ] **Step 9.2: Update `docs/wiki/render.md`**

Add the following section after any existing content (do not remove what's there):

```markdown
## Export Pipeline (Plan 03)

### Code areas covered
- `src/lib/render/` — Renderer interface, PlaywrightRenderer, encode/decode, R2 client/upload, queue, worker
- `src/app/render-frame/` — Internal screenshot target page
- `src/app/api/export/` — Export API routes
- `src/lib/db/schema.ts` — `renderJobs` table

### Flow

1. **POST /api/export** — authenticated user submits `{ templateId, activity, customizations }`.
   - Validates with Zod schemas.
   - Computes `inputHash = SHA-256(canonical JSON)` (stored for future cache use; not used for lookup in v1).
   - Inserts a `render_jobs` row (status: `pending`).
   - Enqueues a pg-boss job on the `render` queue with the full payload.
   - Returns `{ jobId }` (HTTP 202).

2. **Render worker** (`pnpm worker`) — long-running process started by Supervisor/PM2 on Hetzner.
   - Subscribes to the `render` queue (pg-boss, backed by Postgres).
   - Concurrency = `RENDER_QUEUE_CONCURRENCY` (default 2, matches vCPU count).
   - Per job: marks row `processing` → calls `PlaywrightRenderer.render()` → uploads PNG to R2 → marks row `done` with `r2Key`. On error: marks `failed` with `errorMessage`, re-throws for pg-boss retry.

3. **PlaywrightRenderer** — launches headless Chromium, navigates to `/render-frame?secret=...&data=<base64url>`, waits for `networkidle`, screenshots 1080×1920 with `omitBackground: true`.

4. **GET /api/export/:jobId** — authenticated user polls for status.
   - `pending` / `processing` → `{ status }`.
   - `done` → `{ status: 'done', downloadUrl }` where `downloadUrl` is a presigned R2 URL valid for 2 hours.
   - `failed` → `{ status: 'failed', error }`.

### Render frame page (`/render-frame`)

Internal-only. Protected by `RENDER_FRAME_SECRET`. Decodes the `data` query param (base64url JSON validated with Zod), looks up the template via `getTemplate()`, renders `<MapStory>` at 1080×1920 in a bare HTML layout with transparent background. `robots: noindex`. Returns 404 if secret is wrong or data is invalid.

### Cache

Idempotent cache NOT active in v1 (§7 decision: "non implementata in v1"). The `inputHash` column is computed and stored. In a future version: before inserting a new `render_jobs` row, check if a `done` row with the same `inputHash` + valid R2 key exists and return the existing presigned URL.

### R2 Storage

- Bucket: `R2_BUCKET_NAME` (e.g. `mapmapmap-exports`)
- Key format: `exports/<jobId>.png`
- Download: presigned URL, TTL 2h
- Lifecycle rule: configure R2 bucket to auto-delete objects older than 24h (safety margin over the 2h presigned TTL)

### Running the worker locally

```bash
# In terminal 1 — Next.js dev server (render-frame needs this)
pnpm dev

# In terminal 2 — render worker
pnpm worker
```

### Production setup (Ploi on Hetzner)

1. Add env vars to Ploi environment (all vars in `.env.local.example` render section).
2. Run `playwright install chromium --with-deps` after deploy (once per box).
3. Add a Supervisor/PM2 process: `cd /path/to/app && pnpm worker`.
4. Configure R2 bucket lifecycle rule: delete objects older than 24h.
```

- [ ] **Step 9.3: Create `docs/adr/003-export-pipeline.md`**

```markdown
# ADR-003 — Export Pipeline Architecture

**Date:** 2026-06-27
**Status:** Accepted

## Context

MapStory needs to be exported as a 1080×1920 PNG transparent. The render must match the browser preview exactly (same component, same fonts, same CSS). The export is user-triggered, not synchronous with the HTTP request, because Playwright/Chromium takes 1–5 seconds.

## Decision

### Queue: pg-boss on existing Postgres

pg-boss runs on the same Postgres instance already in use. This avoids introducing a new infrastructure component (Redis, SQS, RabbitMQ). For a single-box v1 deployment with expected low render volume (<<100/day), pg-boss is more than sufficient.

Alternative considered: Redis + Bull. Rejected: requires a separate Redis process, more ops overhead.

### Render engine: Playwright/Chromium

Playwright navigates to an internal Next.js page (`/render-frame`) that renders the same `<MapStory>` component used in the browser. This guarantees pixel-identical output to the preview. Playwright handles all CSS (Tailwind, custom fonts) natively.

Alternative considered: Satori + resvg. Rejected: Satori supports a CSS subset and cannot handle filters, glow effects, or complex SVG that future Art templates may require.

Alternative considered: html-to-image client-side. Rejected: fragile on iOS Safari; cannot guarantee consistent output across user devices.

### Storage: Cloudflare R2 with presigned URLs

R2 is already in the stack (spec §3). PNG files are stored under `exports/<jobId>.png` and served via presigned URLs with 2h TTL. A lifecycle rule deletes objects after 24h. This avoids serving PNGs through the Next.js process.

### Cache: Not active in v1

The `Renderer` interface returns a `cacheKey` (SHA-256 of inputs), and `render_jobs` stores `inputHash`. The cache lookup is NOT implemented in v1 because re-renders are acceptable at the current scale and the infrastructure adds complexity.

## Consequences

- Worker must be kept running as a separate process (Supervisor/PM2).
- `playwright install chromium` must run on each new box or after major Playwright version upgrades.
- The `/render-frame` route is internal-only; leaking `RENDER_FRAME_SECRET` would allow unauthenticated access to the renderer.
- As volume grows: turn on the idempotent cache (same `inputHash` → skip render, return cached URL).
```

- [ ] **Step 9.4: Final full test suite run**

```bash
pnpm test:run
```

Expected: all tests pass.

- [ ] **Step 9.5: Type-check + lint**

```bash
pnpm type-check && pnpm lint
```

Expected: 0 errors.

- [ ] **Step 9.6: Commit**

```bash
git add .env.local.example docs/wiki/render.md docs/adr/003-export-pipeline.md package.json
git commit -m "docs: export pipeline wiki, ADR-003, env vars"
```

---

## Self-Review

**Spec coverage check:**

| Spec requirement | Task |
|---|---|
| §7 — Renderer interface `(template, activity, customizations) → { png, cacheKey }` | Task 2 |
| §7 — Playwright/Chromium, omitBackground → PNG trasparente | Task 6 |
| §7 — Queue with concurrency = vCPU | Task 7 (pg-boss, `RENDER_QUEUE_CONCURRENCY`) |
| §7 — cacheKey = deterministic hash of inputs | Task 2 (`hashRenderInput`) |
| §7 — Cache idempotente NON attiva in v1 | Task 8 (POST creates new row each time, no hash lookup) |
| §4 — MapStory used identically in export | Task 4 (render-frame renders `<MapStory>` from props, no state) |
| §3 — R2 for exported PNGs | Task 5 |
| §6.4 — No overlay in transparent mode | Enforced inside `<MapStory>` (Plan 02), not in renderer |
| §5.3 — Strava attribution in PNG | Enforced by `<MapStory>` always including `<StravaAttribution />` |
| §3 — Next.js "vanilla", no Vercel-only features | Route handlers use `NextRequest`/`NextResponse`, no edge runtime |
| §8 — Auth required for export | Tasks 8 (auth check in both routes) |

**Placeholder scan:** No TBDs or TODOs in the plan. All steps contain actual code or specific commands.

**Type consistency check:**
- `hashRenderInput` takes `{ templateId, activity, customizations }` — used consistently in Task 2, Task 6 (`PlaywrightRenderer`), Task 8 (POST route).
- `RenderJobPayload` has `{ jobId, templateId, activity, customizations }` — produced in Task 8 (POST route), consumed in Task 7 (worker).
- `renderJobs` table: `status` uses `renderJobStatusEnum` — matched in Task 1 (schema), Task 7 (worker updates), Task 8 (GET route).
- `decodeRenderData` returns `RenderData | null` — null-checked in Task 4 (render-frame page).
- `getPresignedDownloadUrl(key, ttlSeconds)` — Task 5 signature matches Task 8 call site `(job.r2Key, 7200)`.
