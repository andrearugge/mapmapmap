# Plan 01 — Foundation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fully configured Next.js 15 project with TypeScript, Tailwind CSS 4, Drizzle ORM, Auth.js v5 skeleton, Storybook with 9:16 viewport, Vitest, GitHub Actions CI, and documentation scaffold.

**Architecture:** Single Next.js app (`output: 'standalone'`), App Router, TypeScript strict. Drizzle ORM over postgres.js with a persistent pool (not serverless). Auth.js v5 with Drizzle adapter and a skeleton Strava provider — token encryption and proactive refresh are Phase 3. Storybook runs as a separate process for component authoring.

**Tech Stack:** Next.js 15, React 19, TypeScript 5 (strict), Tailwind CSS 4, shadcn/ui, Drizzle ORM 0.38+, postgres.js 3, next-auth v5 beta, @auth/drizzle-adapter, Storybook 8, Vitest 3, pnpm 9.

## Global Constraints

- No Vercel-only features: no `@vercel/kv`, no `@vercel/blob`, no Vercel edge runtime
- `output: 'standalone'` in `next.config.ts` — mandatory for Hetzner/Ploi deploy
- TypeScript `strict: true` — no exceptions
- pnpm as package manager — never `npm install` or `yarn`
- Node.js ≥ 20
- All secrets in `.env.local` (never committed); `.env.local.example` committed
- Strava OAuth scope: `activity:read` — never `activity:read_all`

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `package.json` | Project manifest, all scripts |
| Create | `next.config.ts` | Next.js config, output standalone |
| Create | `tsconfig.json` | TypeScript strict, path alias `@/*` |
| Create | `.gitignore` | Ignore patterns |
| Create | `.env.local.example` | Env var template (committed, no secrets) |
| Create | `src/app/layout.tsx` | Root layout |
| Create | `src/app/page.tsx` | Home placeholder |
| Create | `src/app/globals.css` | Tailwind 4 import + shadcn base |
| Create | `src/lib/db/schema.ts` | Drizzle table definitions |
| Create | `src/lib/db/index.ts` | postgres.js connection + drizzle instance |
| Create | `drizzle.config.ts` | Drizzle Kit config |
| Create | `src/lib/auth/strava-provider.ts` | Custom Strava OAuth provider (skeleton) |
| Create | `src/auth.ts` | Auth.js v5 config |
| Create | `src/app/api/auth/[...nextauth]/route.ts` | Auth.js API route handler |
| Create | `src/types/next-auth.d.ts` | Session type extension |
| Create | `.storybook/main.ts` | Storybook config, 9:16 viewport |
| Create | `.storybook/preview.tsx` | Storybook globals, CSS import |
| Create | `src/stories/Welcome.stories.tsx` | Smoke story |
| Create | `vitest.config.ts` | Vitest config |
| Create | `vitest.setup.ts` | Test setup |
| Create | `src/__tests__/smoke.test.ts` | First passing test |
| Create | `.github/workflows/ci.yml` | CI: type-check, lint, test |
| Create | `docs/wiki/README.md` | Wiki index |
| Create | `docs/wiki/architecture.md` | Architecture overview + doc map |
| Create | `docs/adr/README.md` | ADR index |
| Create | `docs/adr/001-stack.md` | ADR for stack choices |
| Modify | `claude.md` | Expand Convenzioni e comandi section |

---

## Task 1: Initialize Next.js Project

**Files:**
- Create: `package.json`
- Create: `next.config.ts`
- Create: `tsconfig.json`
- Create: `.gitignore`
- Create: `.env.local.example`
- Create: `src/app/layout.tsx`
- Create: `src/app/page.tsx`

**Interfaces:**
- Produces: `pnpm dev`, `pnpm build`, `pnpm type-check` scripts

- [ ] **Step 1.1: Install Next.js and core dependencies**

```bash
cd /path/to/mapmapmap
pnpm init
pnpm add next@15 react@19 react-dom@19
pnpm add -D typescript@5 @types/node @types/react @types/react-dom
```

Expected: `package.json` and `pnpm-lock.yaml` created.

- [ ] **Step 1.2: Create `next.config.ts`**

```typescript
import type { NextConfig } from 'next'

const config: NextConfig = {
  output: 'standalone',
}

export default config
```

- [ ] **Step 1.3: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": false,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 1.4: Add scripts to `package.json`**

Merge into the `scripts` field:

```json
{
  "scripts": {
    "dev": "next dev --turbopack",
    "build": "next build",
    "start": "next start",
    "type-check": "tsc --noEmit",
    "lint": "next lint"
  }
}
```

- [ ] **Step 1.5: Create `.gitignore`**

```gitignore
# deps
node_modules/
.pnp
.pnp.js

# next
.next/
out/

# env
.env
.env.local
.env.*.local

# misc
*.tsbuildinfo
.DS_Store
storybook-static/
```

- [ ] **Step 1.6: Create `.env.local.example`**

```bash
# Database (postgres.js connection string)
DATABASE_URL="postgres://user:password@localhost:5432/mapmapmap"

# Auth.js (generate: openssl rand -base64 32)
AUTH_SECRET=""
AUTH_URL="http://localhost:3000"

# Strava OAuth — https://www.strava.com/settings/api
STRAVA_CLIENT_ID=""
STRAVA_CLIENT_SECRET=""

# Cloudflare R2
R2_ACCOUNT_ID=""
R2_ACCESS_KEY_ID=""
R2_SECRET_ACCESS_KEY=""
R2_BUCKET_NAME="mapmapmap-assets-temp"
R2_PUBLIC_URL=""
```

- [ ] **Step 1.7: Create `src/app/layout.tsx`**

```tsx
import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Mapmapmap',
  description: 'Turn your Strava activity into an Instagram Story.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="it">
      <body>{children}</body>
    </html>
  )
}
```

- [ ] **Step 1.8: Create `src/app/page.tsx`**

```tsx
export default function Home() {
  return (
    <main>
      <h1>Mapmapmap</h1>
    </main>
  )
}
```

- [ ] **Step 1.9: Verify type-check passes**

```bash
pnpm type-check
```

Expected: no errors.

- [ ] **Step 1.10: Verify build succeeds**

```bash
pnpm build
```

Expected: build completes, `.next/standalone/` directory created.

- [ ] **Step 1.11: Commit**

```bash
git add package.json pnpm-lock.yaml next.config.ts tsconfig.json .gitignore .env.local.example src/
git commit -m "chore: initialize Next.js 15 App Router project"
```

---

## Task 2: Tailwind CSS 4 + shadcn/ui

**Files:**
- Create: `src/app/globals.css`
- Create: `postcss.config.mjs`
- Create: `components.json` (generated by shadcn)
- Create: `src/components/ui/button.tsx` (generated by shadcn)

**Interfaces:**
- Produces: Tailwind utility classes in all components; `pnpm dlx shadcn@latest add <component>` to install UI components into `src/components/ui/`

- [ ] **Step 2.1: Install Tailwind CSS 4**

```bash
pnpm add tailwindcss@4 @tailwindcss/postcss
```

- [ ] **Step 2.2: Create `postcss.config.mjs`**

```js
const config = {
  plugins: {
    '@tailwindcss/postcss': {},
  },
}
export default config
```

- [ ] **Step 2.3: Create `src/app/globals.css`**

```css
@import "tailwindcss";
```

- [ ] **Step 2.4: Initialize shadcn/ui**

```bash
pnpm dlx shadcn@latest init
```

When prompted:
- Style: **Default**
- Base color: **Neutral**
- CSS variables: **Yes**

This updates `globals.css` and creates `components.json`.

- [ ] **Step 2.5: Install Button to verify shadcn works**

```bash
pnpm dlx shadcn@latest add button
```

Expected: `src/components/ui/button.tsx` created.

- [ ] **Step 2.6: Update `src/app/page.tsx` to test Tailwind + shadcn**

```tsx
import { Button } from '@/components/ui/button'

export default function Home() {
  return (
    <main className="flex min-h-screen items-center justify-center">
      <Button>Mapmapmap</Button>
    </main>
  )
}
```

- [ ] **Step 2.7: Verify dev server renders without errors**

```bash
pnpm dev
```

Open http://localhost:3000. Verify button renders. Stop server with Ctrl+C.

- [ ] **Step 2.8: Commit**

```bash
git add postcss.config.mjs src/app/globals.css components.json src/components/ package.json pnpm-lock.yaml
git commit -m "chore: add Tailwind CSS 4 and shadcn/ui"
```

---

## Task 3: Drizzle ORM + Database Schema

**Files:**
- Create: `src/lib/db/schema.ts`
- Create: `src/lib/db/index.ts`
- Create: `drizzle.config.ts`
- Create: `src/lib/db/migrations/` (generated by drizzle-kit)

**Interfaces:**
- Produces:
  - `db` — drizzle instance. Import: `import { db } from '@/lib/db'`
  - `users`, `accounts`, `sessions` — table definitions. Import: `import { users } from '@/lib/db/schema'`

- [ ] **Step 3.1: Install Drizzle + postgres.js**

```bash
pnpm add drizzle-orm postgres
pnpm add -D drizzle-kit
```

- [ ] **Step 3.2: Create `src/lib/db/schema.ts`**

```typescript
import {
  pgTable,
  text,
  timestamp,
  integer,
  primaryKey,
} from 'drizzle-orm/pg-core'
import type { AdapterAccountType } from 'next-auth/adapters'

export const users = pgTable('users', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  stravaAthleteId: text('strava_athlete_id').notNull().unique(),
  name: text('name').notNull(),
  avatarUrl: text('avatar_url'),
  handle: text('handle'),
  role: text('role', { enum: ['user', 'admin'] }).notNull().default('user'),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
})

export const accounts = pgTable(
  'accounts',
  {
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: text('type').$type<AdapterAccountType>().notNull(),
    provider: text('provider').notNull(),
    providerAccountId: text('provider_account_id').notNull(),
    // Strava tokens — encrypted at rest in Phase 3
    refreshToken: text('refresh_token'),
    accessToken: text('access_token'),
    expiresAt: integer('expires_at'),
    tokenType: text('token_type'),
    scope: text('scope'),
    idToken: text('id_token'),
    sessionState: text('session_state'),
  },
  (account) => [
    primaryKey({ columns: [account.provider, account.providerAccountId] }),
  ],
)

export const sessions = pgTable('sessions', {
  sessionToken: text('session_token').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  expires: timestamp('expires', { withTimezone: true }).notNull(),
})
```

- [ ] **Step 3.3: Create `src/lib/db/index.ts`**

```typescript
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is not set')
}

// Persistent pool for Next.js standalone (not serverless).
// Max 10 connections — safe for single-box Hetzner deploy.
const client = postgres(process.env.DATABASE_URL, { max: 10 })

export const db = drizzle(client, { schema })
```

- [ ] **Step 3.4: Create `drizzle.config.ts`**

```typescript
import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  schema: './src/lib/db/schema.ts',
  out: './src/lib/db/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
})
```

- [ ] **Step 3.5: Add DB scripts to `package.json` scripts**

```json
{
  "db:generate": "drizzle-kit generate",
  "db:migrate": "drizzle-kit migrate",
  "db:studio": "drizzle-kit studio"
}
```

- [ ] **Step 3.6: Copy env file and set local DATABASE_URL**

```bash
cp .env.local.example .env.local
```

Edit `.env.local` — set `DATABASE_URL` to your local Postgres instance (must already exist and be reachable).

- [ ] **Step 3.7: Generate initial migration**

```bash
pnpm db:generate
```

Expected: file `src/lib/db/migrations/0000_*.sql` created.

- [ ] **Step 3.8: Run migration**

```bash
pnpm db:migrate
```

Expected output: `All migrations ran successfully.`

- [ ] **Step 3.9: Verify type-check**

```bash
pnpm type-check
```

Expected: no errors.

- [ ] **Step 3.10: Commit**

```bash
git add src/lib/db/ drizzle.config.ts package.json pnpm-lock.yaml
git commit -m "chore: add Drizzle ORM with users/accounts/sessions schema"
```

---

## Task 4: Auth.js v5 Skeleton

**Files:**
- Create: `src/lib/auth/strava-provider.ts`
- Create: `src/auth.ts`
- Create: `src/app/api/auth/[...nextauth]/route.ts`
- Create: `src/types/next-auth.d.ts`

**Interfaces:**
- Produces:
  - `auth()` — server-side session getter. Import: `import { auth } from '@/auth'`
  - `signIn`, `signOut` — Auth.js helpers. Import: `import { signIn, signOut } from '@/auth'`
  - `GET /api/auth/[...nextauth]` and `POST /api/auth/[...nextauth]` — handled

Note: Token encryption and proactive refresh are Phase 3 (Plan 04). This task wires up the skeleton so the project builds and type-checks cleanly.

- [ ] **Step 4.1: Install Auth.js v5 + Drizzle adapter**

```bash
pnpm add next-auth@beta @auth/drizzle-adapter
```

- [ ] **Step 4.2: Create `src/lib/auth/strava-provider.ts`**

```typescript
import type { OAuthConfig, OAuthUserConfig } from 'next-auth/providers'

/** Shape returned by GET https://www.strava.com/api/v3/athlete */
export interface StravaProfile {
  id: number
  firstname: string
  lastname: string
  profile_medium: string
  username: string | null
}

export function StravaProvider(
  config: OAuthUserConfig<StravaProfile>,
): OAuthConfig<StravaProfile> {
  return {
    id: 'strava',
    name: 'Strava',
    type: 'oauth',
    authorization: {
      url: 'https://www.strava.com/oauth/authorize',
      params: {
        scope: 'activity:read',
        response_type: 'code',
        approval_prompt: 'auto',
      },
    },
    token: 'https://www.strava.com/oauth/token',
    userinfo: 'https://www.strava.com/api/v3/athlete',
    profile(profile: StravaProfile) {
      return {
        id: String(profile.id),
        name: `${profile.firstname} ${profile.lastname}`.trim(),
        email: null, // Strava does not provide email
        image: profile.profile_medium,
        stravaAthleteId: String(profile.id),
        handle: profile.username ?? null,
      }
    },
    ...config,
  }
}
```

- [ ] **Step 4.3: Create `src/auth.ts`**

```typescript
import NextAuth from 'next-auth'
import { DrizzleAdapter } from '@auth/drizzle-adapter'
import { db } from '@/lib/db'
import { accounts, sessions, users } from '@/lib/db/schema'
import { StravaProvider } from '@/lib/auth/strava-provider'

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
  }),
  providers: [
    StravaProvider({
      clientId: process.env.STRAVA_CLIENT_ID!,
      clientSecret: process.env.STRAVA_CLIENT_SECRET!,
    }),
  ],
  session: { strategy: 'database' },
  callbacks: {
    session({ session, user }) {
      session.user.id = user.id
      return session
    },
  },
})
```

- [ ] **Step 4.4: Create `src/app/api/auth/[...nextauth]/route.ts`**

```typescript
import { handlers } from '@/auth'
export const { GET, POST } = handlers
```

- [ ] **Step 4.5: Create `src/types/next-auth.d.ts`**

```typescript
import type { DefaultSession } from 'next-auth'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
    } & DefaultSession['user']
  }
}
```

- [ ] **Step 4.6: Verify type-check passes**

```bash
pnpm type-check
```

Expected: no errors.

- [ ] **Step 4.7: Commit**

```bash
git add src/auth.ts src/app/api/ src/lib/auth/ src/types/ package.json pnpm-lock.yaml
git commit -m "chore: add Auth.js v5 skeleton with Strava provider"
```

---

## Task 5: Storybook 8 with 9:16 Viewport

**Files:**
- Create: `.storybook/main.ts`
- Create: `.storybook/preview.tsx`
- Create: `src/stories/Welcome.stories.tsx`

**Interfaces:**
- Produces: `pnpm storybook` launches Storybook on port 6006 with a `1080×1920` viewport preset active by default; `pnpm storybook:build` produces a static export in `storybook-static/`

- [ ] **Step 5.1: Initialize Storybook**

```bash
pnpm dlx storybook@latest init --type nextjs
```

Accept defaults when prompted. This installs Storybook dependencies and scaffolds `.storybook/`.

- [ ] **Step 5.2: Replace `.storybook/main.ts`**

```typescript
import type { StorybookConfig } from '@storybook/nextjs'

const config: StorybookConfig = {
  stories: ['../src/**/*.stories.@(ts|tsx)'],
  addons: [
    '@storybook/addon-essentials',
    '@storybook/addon-a11y',
  ],
  framework: {
    name: '@storybook/nextjs',
    options: {},
  },
  staticDirs: ['../public'],
}

export default config
```

- [ ] **Step 5.3: Replace `.storybook/preview.tsx`**

```tsx
import type { Preview } from '@storybook/react'
import '../src/app/globals.css'

const VIEWPORT_1080x1920 = {
  name: '9:16 — 1080×1920 (Instagram Story)',
  type: 'desktop' as const,
  width: 1080,
  height: 1920,
}

const preview: Preview = {
  parameters: {
    viewport: {
      viewports: {
        story: VIEWPORT_1080x1920,
      },
      defaultViewport: 'story',
    },
    backgrounds: {
      default: 'white',
      values: [
        { name: 'white', value: '#ffffff' },
        { name: 'black', value: '#000000' },
        { name: 'transparent', value: 'transparent' },
      ],
    },
  },
}

export default preview
```

- [ ] **Step 5.4: Add Storybook scripts to `package.json`**

```json
{
  "storybook": "storybook dev -p 6006",
  "storybook:build": "storybook build"
}
```

- [ ] **Step 5.5: Delete Storybook's auto-generated sample stories**

```bash
rm -rf src/stories/
```

- [ ] **Step 5.6: Create smoke story `src/stories/Welcome.stories.tsx`**

```tsx
import type { Meta, StoryObj } from '@storybook/react'

function WelcomeCanvas() {
  return (
    <div
      style={{
        width: 1080,
        height: 1920,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#1B3D72',
        color: '#fff',
        fontFamily: 'system-ui',
        fontSize: 48,
        fontWeight: 'bold',
      }}
    >
      Mapmapmap
    </div>
  )
}

const meta: Meta<typeof WelcomeCanvas> = {
  title: 'Canvas/Welcome',
  component: WelcomeCanvas,
}
export default meta

export const Default: StoryObj<typeof WelcomeCanvas> = {}
```

- [ ] **Step 5.7: Verify Storybook static build**

```bash
pnpm storybook:build
```

Expected: build completes with no errors; `storybook-static/` created.

- [ ] **Step 5.8: Commit**

```bash
git add .storybook/ src/stories/ package.json pnpm-lock.yaml
git commit -m "chore: add Storybook 8 with 1080×1920 viewport preset"
```

---

## Task 6: Vitest

**Files:**
- Create: `vitest.config.ts`
- Create: `vitest.setup.ts`
- Create: `src/__tests__/smoke.test.ts`

**Interfaces:**
- Produces: `pnpm test` (watch mode) and `pnpm test:run` (single run for CI)

- [ ] **Step 6.1: Install Vitest + Testing Library**

```bash
pnpm add -D vitest @vitejs/plugin-react @testing-library/react @testing-library/dom jsdom
```

- [ ] **Step 6.2: Create `vitest.config.ts`**

```typescript
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    globals: true,
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
})
```

- [ ] **Step 6.3: Create `vitest.setup.ts`**

```typescript
import '@testing-library/dom'
```

- [ ] **Step 6.4: Add test scripts to `package.json`**

```json
{
  "test": "vitest",
  "test:run": "vitest run"
}
```

- [ ] **Step 6.5: Create `src/__tests__/smoke.test.ts`**

```typescript
describe('smoke', () => {
  it('true is true', () => {
    expect(true).toBe(true)
  })
})
```

- [ ] **Step 6.6: Run tests and verify they pass**

```bash
pnpm test:run
```

Expected output:
```
✓ src/__tests__/smoke.test.ts (1)
  ✓ smoke > true is true

Test Files  1 passed (1)
Tests       1 passed (1)
```

- [ ] **Step 6.7: Commit**

```bash
git add vitest.config.ts vitest.setup.ts src/__tests__/ package.json pnpm-lock.yaml
git commit -m "chore: configure Vitest with jsdom and Testing Library"
```

---

## Task 7: GitHub Actions CI

**Files:**
- Create: `.github/workflows/ci.yml`

**Interfaces:**
- Produces: CI pipeline running `type-check`, `lint`, `test:run` on every push and PR to `main`

- [ ] **Step 7.1: Create `.github/workflows/ci.yml`**

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  check:
    name: Type-check, Lint, Test
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4
        with:
          version: 9

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Type check
        run: pnpm type-check

      - name: Lint
        run: pnpm lint

      - name: Test
        run: pnpm test:run
```

- [ ] **Step 7.2: Verify an `.eslintrc.json` exists (Next.js may have created it)**

If missing, create it:

```json
{
  "extends": "next/core-web-vitals"
}
```

- [ ] **Step 7.3: Verify lint passes locally**

```bash
pnpm lint
```

Expected: no errors, or only warnings.

- [ ] **Step 7.4: Commit**

```bash
git add .github/ .eslintrc.json
git commit -m "chore: add GitHub Actions CI (type-check, lint, test)"
```

---

## Task 8: Documentation Scaffold + ADR-001

**Files:**
- Create: `docs/wiki/README.md`
- Create: `docs/wiki/architecture.md`
- Create: `docs/adr/README.md`
- Create: `docs/adr/001-stack.md`

**Interfaces:**
- Produces: navigable documentation structure; ADR-001 records all stack decisions from this plan

- [ ] **Step 8.1: Create `docs/wiki/README.md`**

```markdown
# Mapmapmap — Wiki

Wiki narrativa: fonte viva del "cosa fa l'app". Ogni pagina dichiara in testa quali aree di codice copre (doc map).

## Pagine

- [architecture.md](./architecture.md) — stack, hosting, principi architetturali *(Fase 0)*
- [contracts.md](./contracts.md) — contratti dati §6 *(Fase 1)*
- [render.md](./render.md) — MapStory, pipeline di render *(Fase 1)*
- [auth.md](./auth.md) — OAuth Strava, token *(Fase 3)*
- [editor.md](./editor.md) — editor utente, UX mobile *(Fase 4)*
- [art-catalog.md](./art-catalog.md) — catalogo Art *(Fase 6)*
- [admin.md](./admin.md) — funzionalità admin *(Fase 8)*
- [gdpr.md](./gdpr.md) — compliance *(Fase 9)*
- [deploy.md](./deploy.md) — runbook deploy *(Fase 10)*
```

- [ ] **Step 8.2: Create `docs/wiki/architecture.md`**

```markdown
---
doc-map:
  areas: [next.config.ts, src/lib/db/, src/auth.ts, .storybook/]
  last-updated: 2026-06-26
  updated-by: plan-01-foundation
---

# Architecture

## Stack

| Layer | Technology | Version |
|---|---|---|
| Framework | Next.js App Router | 15 |
| Language | TypeScript (strict) | 5 |
| Styling | Tailwind CSS 4 + shadcn/ui | 4 |
| ORM | Drizzle ORM | 0.38+ |
| DB driver | postgres.js | 3 |
| Auth | Auth.js v5 (NextAuth) | 5 beta |
| Component dev | Storybook | 8 |
| Test | Vitest + Testing Library | 3 |
| Package mgr | pnpm | 9 |

## Hosting

- **Server**: Hetzner CPX21/CPX31, managed via ploi.io
- **CDN / DNS / SSL**: Cloudflare
- **Object storage**: Cloudflare R2 (S3-compatible, no egress fee)
- **Postgres**: co-locato sulla stessa box, `max: 10` connections, nessun PgBouncer

## Deployment model

`next build` → `output: 'standalone'` → deployato su Ploi come processo Node.js.
Stessa app per: landing, area utente, `/admin`, API export.

## Architectural principles

- **No Vercel-only features** — il target è Hetzner; il codebase non tocca mai `@vercel/*`.
- **Postgres co-locato** — processo Node persistente → pool normale, latenza sub-ms.
- **Render worker isolato** — `<MapStory>` è una funzione pura; lo screenshot (Playwright) gira in coda (pg-boss) con concorrenza = vCPU.

## Related ADRs

- [ADR-001: Stack](../adr/001-stack.md)
```

- [ ] **Step 8.3: Create `docs/adr/README.md`**

```markdown
# Architecture Decision Records

| ID | Titolo | Data | Stato |
|---|---|---|---|
| [001](./001-stack.md) | Stack tecnologico | 2026-06-26 | Accepted |
```

- [ ] **Step 8.4: Create `docs/adr/001-stack.md`**

```markdown
# ADR-001: Stack Tecnologico

**Data:** 2026-06-26
**Stato:** Accepted

## Contesto

Mapmapmap v1 è una web app mobile-first per generare Instagram Story a partire da dati Strava. Target deploy: Hetzner (non Vercel). Stack scelto per minimizzare i provider, massimizzare la portabilità, validare velocemente.

## Decisioni

### Next.js 15 App Router + `output: 'standalone'`
Unica app che ospita landing, area utente, `/admin`, endpoint export. `output: 'standalone'` per deploy Node.js su Ploi senza Docker obbligatorio.
**Alternativa scartata**: Remix — meno maturo sull'ecosistema Drizzle + Auth.js.

### TypeScript 5 strict
Standard. Non negoziabile.

### Tailwind CSS 4 + shadcn/ui
Tailwind 4 (CSS-first, nessun config JS). shadcn/ui per i componenti admin.
**Alternativa scartata**: CSS Modules (verbosi), styled-components (runtime overhead).

### Drizzle ORM + postgres.js
Drizzle: type-safe, migrations esplicite, no query builder "magico". postgres.js: migliore TypeScript support rispetto a `pg`, zero overhead.
**Alternative scartate**: Prisma (schema.prisma duplica i tipi TypeScript, overhead di generazione); Neon/Supabase (DB serverless non necessario con processo Node persistente).

### Auth.js v5 (NextAuth) + Drizzle adapter
Standard de facto per Next.js. Adapter Drizzle disponibile. Strava provider custom (Strava non è incluso nei provider nativi di NextAuth v5).
**Alternative scartate**: Lucia (più boilerplate, meno ecosystem); Clerk (SaaS lock-in, non portabile).

### Storybook 8
Catalogo vivo per lo sviluppo delle Art (componenti 9:16). Addon Viewport per canvas 1080×1920 fisso. Addon Controls per mappare `customizationSchema`.
**Alternativa scartata**: Ladle — nessun addon equivalente per viewport personalizzati e controls da schema Zod.

### Vitest + Testing Library
Vitest: veloce, nessuna configurazione Babel extra, JSX nativo con plugin React.
**Alternativa scartata**: Jest — più lento con Next.js, configurazione SWC/Babel più verbosa.

### pnpm
Deterministic lockfile, più veloce di npm, monorepo-ready se necessario.

## Conseguenze

- Nessuna feature Vercel-only (`@vercel/*`) è ammessa nel codebase.
- `pnpm` è obbligatorio; `npm install` e `yarn` sono vietati.
- Il codebase deve rimanere deployabile su Hetzner senza modifiche strutturali.
```

- [ ] **Step 8.5: Commit**

```bash
git add docs/
git commit -m "docs: scaffold wiki, ADR-001, plans directory"
```

---

## Task 9: Update CLAUDE.md Convenzioni

**Files:**
- Modify: `claude.md`

**Interfaces:**
- Produces: `claude.md` with a fully populated "Convenzioni e comandi" section replacing the placeholder

- [ ] **Step 9.1: Replace the placeholder "Convenzioni e comandi" section in `claude.md`**

Find and replace the entire section:

```markdown
## Convenzioni e comandi
**Da definire dopo lo scaffolding** (struttura cartelle, naming, comandi build/test/lint, avvio Storybook, generazione API ref). Espandere questa sezione come primo task post-setup, non prima: ora sarebbe inventata.
```

With:

```markdown
## Convenzioni e comandi

### Package manager
**pnpm** sempre. Mai `npm install` o `yarn`.

### Struttura cartelle
```
src/
├── app/                    # Next.js App Router (routes, layouts, API)
│   ├── (user)/             # Area utente autenticata (mobile-first)
│   ├── admin/              # Mini-admin (role-gated, desktop)
│   └── api/                # Route handler API
├── components/
│   ├── ui/                 # shadcn/ui (generati, non editare a mano)
│   ├── art/                # <MapStory> e layer renderer
│   └── editor/             # Componenti editor utente
├── lib/
│   ├── db/                 # Schema Drizzle, migration, client
│   ├── auth/               # Auth.js config, Strava provider
│   ├── strava/             # Strava API client, normalizzazione polyline
│   ├── render/             # Interfaccia Renderer, implementazione Playwright
│   └── art/                # Registro Art, tipo Template
├── stories/                # Storybook stories
└── types/                  # Tipi TypeScript condivisi e overrides
```

### Comandi

| Azione | Comando |
|---|---|
| Dev server | `pnpm dev` |
| Type check | `pnpm type-check` |
| Lint | `pnpm lint` |
| Test (watch) | `pnpm test` |
| Test (CI) | `pnpm test:run` |
| Build | `pnpm build` |
| Storybook | `pnpm storybook` |
| Storybook build | `pnpm storybook:build` |
| DB generate migration | `pnpm db:generate` |
| DB run migration | `pnpm db:migrate` |
| DB studio | `pnpm db:studio` |

### Naming

- Componenti React: PascalCase (`MapStory`, `StravaAttribution`)
- Hooks: camelCase con prefisso `use` (`useMapExport`)
- Utility/lib: camelCase (`normalizePolyline`)
- File componenti: same as component (`MapStory.tsx`)
- Route folders: kebab-case (`activity-picker/`)
- Test files: `*.test.ts` / `*.test.tsx` accanto al file testato, oppure in `src/__tests__/`

### API reference
Generata con TypeDoc: `pnpm typedoc` (configurato in Fase 1). Non scrivere API ref a mano.
```

- [ ] **Step 9.2: Verify Markdown is valid (no broken code fences)**

Read the file and visually check the structure.

- [ ] **Step 9.3: Commit**

```bash
git add claude.md
git commit -m "docs: populate CLAUDE.md Convenzioni e comandi"
```

---

## Self-Review

**Spec coverage check:**

| Requirement | Source | Covered by |
|---|---|---|
| Next.js vanilla, `output: 'standalone'` | §3 | Task 1 |
| Tailwind + shadcn/ui | §3 | Task 2 |
| Drizzle ORM | §3 | Task 3 |
| Auth.js Strava skeleton (scope `activity:read`) | §3, §5 | Task 4 |
| Postgres co-locato, `max: 10` | §3 | Task 3 |
| Storybook with 9:16 viewport | §10 | Task 5 |
| `docs/wiki/`, `docs/adr/` scaffold | CLAUDE.md | Task 8 |
| ADR-001 | CLAUDE.md | Task 8 |
| Convenzioni e comandi in CLAUDE.md | CLAUDE.md | Task 9 |

**Not in this plan (intentionally deferred):**
- Hetzner + Ploi setup: manual infra, not codeable
- Cloudflare + R2: manual infra, not codeable
- Zod: installed in Plan 02 (contracts)
- Token encryption: Plan 04 (Strava auth)
- pg-boss: Plan 03 (export server)

**Placeholder scan:** no TBD, TODO, "implement later", or "similar to" patterns found.

**Type consistency:** `db` from `@/lib/db`, `users/accounts/sessions` from `@/lib/db/schema`, `auth/signIn/signOut` from `@/auth` — used consistently across tasks 3 and 4.
