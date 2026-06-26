---
doc-map:
  areas: [src/components/art/, src/lib/art/]
  last-updated: 2026-06-26
  updated-by: plan-02-mapstory-core
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
