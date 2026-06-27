---
doc-map:
  areas: [src/components/art/, src/lib/art/, src/lib/render/, src/app/render-frame/, src/app/api/export/, src/lib/db/schema.ts]
  last-updated: 2026-06-27
  updated-by: plan-03-export-pipeline
---

# Render Architecture

## The Three Contexts

`<MapStory>` runs identically in three contexts:

| Context | Where | How |
|---------|-------|-----|
| Authoring | Storybook | `pnpm storybook` — HMR, live controls |
| Editor preview | Browser (mobile) | Scaled to viewport, updates on every control change |
| Export | Playwright/Chromium server-side | Screenshot at 1080×1920, `omitBackground:true` → PNG trasparente |

## MapStory Component

`src/components/art/MapStory.tsx` — pure function, no hooks, no fetch.

Rendering pipeline:
1. Split layers into `frame` (absolute in 1080×1920) and `cluster` (inside repositionable wrapper)
2. Render frame layers (background, overlay, attribution)
3. Compute cluster bounding box → call `anchorToPosition(artPosition, bounds)`
4. Render cluster layers inside absolutely-positioned wrapper
5. Guarantee `<StravaAttribution />` is always present

## Layer System

Each `LayerNode.kind` maps to a component in `src/components/art/layers/`.
Style tokens (`primary`/`accent`) are resolved to hex via `resolveColor()`.

## Route Normalization

`src/lib/art/normalize-route.ts` — called in the data layer (Plan 04), not in MapStory.
Input: `[lat, lng][]` (raw coordinates). Output: `[x, y][]` in `[0..1]²`, aspect preserved, fit-centered, Y-flipped (north=up).

## Purity Test

`src/components/art/__tests__/MapStory.purity.test.tsx` — runs in CI, never removed.
Guards: same input → same innerHTML. StravaAttribution always present. Overlay absent when background is transparent.

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
