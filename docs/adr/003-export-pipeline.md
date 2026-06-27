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
