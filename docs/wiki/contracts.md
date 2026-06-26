---
doc-map:
  areas: [src/types/map-story.ts, src/lib/schemas/]
  last-updated: 2026-06-26
  updated-by: plan-02-mapstory-core
---

# Data Contracts (§6)

Source-agnostic data contracts. These are binding — do not change without updating consuming code and adding an ADR.

## ActivityData

Normalized activity. `route.points` are already in `[0..1]²` (normalization happens in the data layer, not in MapStory). Values are raw SI — formatting (km, pace, locale IT) happens inside the component.

See `src/types/map-story.ts` for the full type. See `src/lib/schemas/activity.ts` for the Zod schema.

## Template

Defines the static structure of an Art: layers, z-order, styles, allowed anchor positions, and the customizationSchema. Immutable at runtime.

See `src/lib/art/arts/*/index.ts` for examples.

## Customizations

User-controlled level: `primary` (hex), `accent` (hex), `background` (transparent or image+overlay), `artPosition` (Anchor).

Style tokens `primary` and `accent` are the only tokens. Adding new tokens is forbidden.

See `src/lib/schemas/customizations.ts` for the Zod schema.

## LayerNode

Each layer is discriminated by `kind`. `placement: 'frame'` = fixed in 1080×1920. `placement: 'cluster'` = inside the repositionable cluster wrapper.

## Safe Area

- Top: 250px (Instagram Story profile/progress bar)
- Bottom: 250px (reply bar, link sticker zone)
- Safe band: 1080×1420 (y 250–1670)
- Cluster positions respect these bounds via `anchorToPosition()`.
