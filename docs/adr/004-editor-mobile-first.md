# ADR-004 — Editor Mobile-First Layout and Share Flow

**Date:** 2026-06-27
**Status:** Accepted

## Context

The editor is the central user-facing screen. It must display a live 9:16 preview of the MapStory alongside colour and position controls on a phone (≈ 390 px wide), and then allow the user to export and share the PNG with as few taps as possible.

## Decision: Canvas Scaling via ResizeObserver + CSS transform

`<MapStory>` renders at 1080×1920 (its spec size). Scaling it down to the phone's width requires a container that reports its pixel size at runtime.

**Chosen approach:** `ResizeObserver` on the container div + `transform: scale(containerWidth / 1080)` on the inner 1080-px div. `transform-origin: top left` so the scaled output is anchored at the top.

**Alternative: CSS `zoom`.** Simpler but `zoom` is non-standard and behaves differently in Storybook vs Safari vs Chrome. Rejected for cross-browser consistency.

**Alternative: viewport units inside `<MapStory>`.** Would require `<MapStory>` to know its rendered size, violating the "no implicit inputs" invariant (§4). Rejected.

**Alternative: `<iframe>` + static scale.** Adds an iframe boundary, complicates font loading, and breaks the React component tree. Rejected.

## Decision: Fixed Bottom Controls Panel (not a slide-up sheet)

A bottom sheet with drag-to-expand adds significant UX engineering complexity for v1. A fixed-height panel at the bottom is simpler and sufficient for the three controls (two colour pickers + position pills). Can be upgraded to a proper sheet in a later iteration.

## Decision: Web Share API with download fallback

`navigator.share({ files: [pngFile] })` (Web Share Level 2) is supported on iOS Safari and Android Chrome — the primary devices for the target audience. It opens the native OS share sheet, allowing direct send to Instagram Stories without clipboard gymnastics.

**Fallback:** A programmatic `<a download>` click for desktop and unsupported browsers.

**Alternative: Clipboard API.** Instagram doesn't accept clipboard paste in the Stories upload flow on mobile. Rejected.

**Alternative: Server-side redirect to presigned URL.** Works but bypasses the share sheet. The user would have to manually navigate to Instagram and upload. Rejected as friction.

## Decision: `<input type="color">` for colour pickers

Native colour pickers are zero-dependency and work on all target browsers. The UX on iOS is adequate for v1.

**Alternative: Custom hex input only.** Less discoverable. Rejected.

**Alternative: Third-party colour picker library.** Adds bundle weight. Overkill for v1 with two colour values. Rejected.

## Consequences

- `<MapStory>` continues to receive exactly 1080 CSS px — same as the Playwright renderer, maintaining visual consistency between preview and export.
- The share flow requires the user to interact with a button (a user gesture), which is required by the Web Share API security model.
- `navigator.canShare` is checked at runtime; no static feature detection. The Share button always appears, but falls back to download if the API is unavailable.
