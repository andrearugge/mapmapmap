---
doc-map:
  areas: [src/components/editor/, src/hooks/use-export.ts, src/app/(user)/editor/, src/lib/art/default-customizations.ts, src/lib/strava/get-cached-activity.ts]
  last-updated: 2026-06-27
  updated-by: plan-05-editor-share-flow
---

# Editor — User-Facing Editor and Share Flow

## Overview

The editor is the core user-facing feature: it lets an authenticated user pick an Art template, customise colours and position, export a 1080×1920 transparent PNG, and share it directly to Instagram (or download it).

## Flow

```
/activity-picker  →  /editor/[activityId]  →  /editor/[activityId]/[templateId]
     (Plan 04)           Template Picker                  Editor
```

1. **Template Picker** (`/editor/[activityId]/page.tsx`) — Server Component. Reads the selected `ActivityData` from the `activities` table via `getCachedActivity(userId, activityId)`. Lists all `Template` objects registered in `artRegistry`. Tapping a template card navigates to the editor.

2. **Editor** (`/editor/[activityId]/[templateId]/page.tsx`) — Server Component. Fetches the activity and looks up the template via `artRegistry.get(templateId)`. Renders `<EditorShell>` with both as props.

3. **EditorShell** (`src/components/editor/EditorShell.tsx`) — Client Component. Owns the `Customizations` state (initialised via `defaultCustomizations(template)`). Composes:
   - `<EditorCanvas>` — scaled live preview
   - Status strip — visible during export and on error
   - `<EditorControls>` — customisation inputs + export button
   - "Share" button in header — visible when export is done

## Components

### EditorCanvas

`src/components/editor/EditorCanvas.tsx`

Renders `<MapStory>` at its native 1080×1920 resolution inside a `position: absolute` div. A `ResizeObserver` measures the container width and sets `transform: scale(containerWidth / 1080)` on the inner div. The container has `width: 100%; aspect-ratio: 1080/1920` so the height auto-follows. This guarantees `<MapStory>` always sees exactly 1080 CSS pixels (same as the export renderer).

### EditorControls

`src/components/editor/EditorControls.tsx`

Stateless. Props: `template`, `customizations`, `onChange`, `onExport`, `exportDisabled`. Renders:
- **Primary / Accent** — paired `<input type="color">` (native picker) and `<input type="text">` (hex value). `onChange` is only called when the text value matches `/^#[0-9A-Fa-f]{6}$/` (ignores mid-type partials).
- **Position** — one pill button per `template.allowedAnchors`. The active anchor gets inverted colours. Minimum touch target 44 px.
- **Export PNG** — disabled while export is in progress or already done.

## Export Lifecycle (useExport hook)

`src/hooks/use-export.ts`

States: `idle → requesting → polling → done | error`

1. `startExport(payload)` — calls `POST /api/export` with `{ templateId, activity, customizations }`.
2. On `202`: transitions to `polling`, then polls `GET /api/export/[jobId]` every 1500 ms.
3. On `status: 'done'`: transitions to `done` with `downloadUrl` (presigned R2 URL, 2h TTL).
4. On `status: 'failed'` or timeout (40 polls ≈ 60 s): transitions to `error`.
5. `reset()` — aborts the in-flight request (AbortController) and returns to `idle`.

## Share / Download

When export is `done`, the user taps "Share" in the header:

1. `fetch(downloadUrl)` → `Blob` → `File('mapmapmap.png', { type: 'image/png' })`
2. If `navigator.canShare?.({ files: [file] })` → `navigator.share({ files, title: activity.name })` — opens the native iOS/Android share sheet, allowing direct send to Instagram Stories.
3. Otherwise: creates a temporary `<a download>` element and triggers a click → browser download dialog.

## getCachedActivity

`src/lib/strava/get-cached-activity.ts`

Reads a single `ActivityData` from the `activities` table. Applies a `userId` guard in the `WHERE` clause to prevent cross-user access. Returns `null` if not found; the calling Server Component redirects to `/activity-picker`.

## defaultCustomizations

`src/lib/art/default-customizations.ts`

Pure function: `(template: Template) → Customizations`. Initial values: `primary: '#ffffff'`, `accent: '#000000'`, `background: { type: 'transparent' }`, `artPosition: template.defaultAnchor`. Called once by `EditorShell` as the `useState` initialiser.

## Route Protection

`/editor/:path*` is covered by `src/middleware.ts` — unauthenticated requests are redirected to `/`.
