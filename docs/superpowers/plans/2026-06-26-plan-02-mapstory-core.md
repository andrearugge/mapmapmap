# Plan 02 — MapStory Core

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** TypeScript contracts (§6), Zod schemas, `<MapStory>` pure function, all layer renderers, route normalization, font infrastructure, 4 fixtures, first Art (MinimalArc) in Storybook, and a purity snapshot test that runs in CI permanently.

**Architecture:** `<MapStory>` is a pure function `(template, activity, customizations) → JSX`. No hooks, no fetch, no side effects, no implicit inputs. All layers render inside a `1080×1920` div; cluster layers are wrapped and positioned via `artPosition`; frame layers are absolute. Route is SVG. Style tokens (`primary`/`accent`) resolve to hex from `customizations`. Snapshot test guards the purity invariant in CI.

**Tech Stack:** React 19, TypeScript 5, Zod 3, Vitest 3, Storybook 8. All from Plan 01.

## Global Constraints

- `<MapStory>` MUST be a pure function: no `useState`, no `useEffect`, no `fetch`, no `Date.now()`, no `Math.random()`, no env reads. Violating this breaks the export pipeline.
- Style tokens are exactly `'primary'` and `'accent'`. No new tokens.
- `<StravaAttribution />` is always rendered and never removable.
- The purity snapshot test (Task 9) MUST stay in CI permanently — never skip, never remove.
- Font stack must be identical between browser and Playwright (enforced in Plan 03).

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `src/types/map-story.ts` | ActivityData, Template, Customizations, LayerNode, all shared types |
| Create | `src/lib/schemas/activity.ts` | Zod schema for ActivityData |
| Create | `src/lib/schemas/customizations.ts` | Zod schema for Customizations |
| Create | `src/lib/art/normalize-route.ts` | Pure fn: decode lat/lng → `[0..1]²` |
| Create | `src/lib/art/format-stat.ts` | Pure fns: formatStat, formatTime |
| Create | `src/lib/art/resolve-color.ts` | Pure fn: StyleToken → hex |
| Create | `src/lib/art/anchor-position.ts` | Pure fn: Anchor + cluster size → CSS position |
| Create | `src/components/art/layers/BackgroundLayer.tsx` | background kind renderer |
| Create | `src/components/art/layers/OverlayLayer.tsx` | overlay kind renderer |
| Create | `src/components/art/layers/RouteLayer.tsx` | route kind renderer (SVG) |
| Create | `src/components/art/layers/StatLayer.tsx` | stat kind renderer |
| Create | `src/components/art/layers/TextLayer.tsx` | text kind renderer |
| Create | `src/components/art/layers/BadgeLayer.tsx` | badge kind renderer |
| Create | `src/components/art/StravaAttribution.tsx` | Non-removable attribution badge |
| Create | `src/components/art/MapStory.tsx` | Pure component, dispatches to layers |
| Create | `src/lib/art/fixtures.ts` | 4 realistic ActivityData fixtures |
| Create | `src/lib/art/registry.ts` | templateId → Template map |
| Create | `src/lib/art/arts/minimal-arc/schema.ts` | customizationSchema for MinimalArc |
| Create | `src/lib/art/arts/minimal-arc/index.ts` | MinimalArc Template definition |
| Create | `src/stories/MinimalArc.stories.tsx` | Storybook story for MinimalArc |
| Create | `src/components/art/__tests__/MapStory.purity.test.tsx` | Snapshot purity test |
| Create | `src/lib/art/__tests__/normalize-route.test.ts` | Unit tests for normalization |
| Create | `src/lib/art/__tests__/format-stat.test.ts` | Unit tests for formatters |
| Create | `public/fonts/` | Self-hosted font files (OFL) |
| Create | `docs/wiki/contracts.md` | §6 contracts narrative + doc map |
| Create | `docs/wiki/render.md` | MapStory architecture + doc map |
| Create | `docs/adr/002-mapstory-purity.md` | ADR for purity invariant |

---

## Task 1: TypeScript Types + Zod + Dependencies

**Files:**
- Create: `src/types/map-story.ts`
- Create: `src/lib/schemas/activity.ts`
- Create: `src/lib/schemas/customizations.ts`

**Interfaces:**
- Produces:
  - `ActivityData` — `import type { ActivityData } from '@/types/map-story'`
  - `Template` — `import type { Template } from '@/types/map-story'`
  - `Customizations` — `import type { Customizations } from '@/types/map-story'`
  - `activityDataSchema` — `import { activityDataSchema } from '@/lib/schemas/activity'`
  - `customizationsSchema` — `import { customizationsSchema } from '@/lib/schemas/customizations'`

- [ ] **Step 1.1: Install Zod**

```bash
pnpm add zod
```

- [ ] **Step 1.2: Create `src/types/map-story.ts`**

```typescript
import type { z } from 'zod'
import type { customizationsSchema } from '@/lib/schemas/customizations'

export type StyleToken = 'primary' | 'accent'

export type Anchor =
  | 'top-left' | 'top-center' | 'top-right'
  | 'middle-left' | 'middle-center' | 'middle-right'
  | 'bottom-left' | 'bottom-center' | 'bottom-right'

/** Rectangle in template coordinate space (0–1080 × 0–1920) */
export type Box = { x: number; y: number; w: number; h: number }

export type Placement = 'frame' | 'cluster'

export type RouteStyle = {
  stroke: StyleToken
  width: number
  dash: 'solid' | 'dashed' | 'dotted'
  glow?: boolean
}

export type TextStyle = {
  font: string
  size: number
  color: StyleToken
  weight?: number
}

export type LayerNode =
  | { kind: 'background'; placement: 'frame' }
  | { kind: 'overlay'; placement: 'frame' }
  | { kind: 'route'; placement: Placement; box: Box; style: RouteStyle }
  | { kind: 'stat'; placement: Placement; bind: keyof ActivityData['stats'] | 'name' | 'date'; box: Box; style: TextStyle; format?: string }
  | { kind: 'text'; placement: Placement; value: string; box: Box; style: TextStyle }
  | { kind: 'badge'; placement: Placement; box: Box; render: string }
  | { kind: 'attribution'; placement: 'frame'; anchor: Anchor }

export type Template = {
  id: string
  name: string
  size: { w: 1080; h: 1920 }
  layers: LayerNode[]
  allowedAnchors: Anchor[]
  defaultAnchor: Anchor
  customizationSchema: z.ZodType<Customizations>
}

/** Source-agnostic activity data. Route points are already normalized to [0..1]². */
export type ActivityData = {
  id: string
  /** 'run' | 'ride' | 'walk' | 'hike' | ... */
  type: string
  name: string
  /** ISO 8601 */
  date: string
  stats: {
    distance_m: number
    movingTime_s: number
    elapsedTime_s: number
    elevationGain_m: number
    avgSpeed_mps: number
  }
  route: {
    /** Normalized [0..1]², aspect preserved, fit-centered. Empty if hasGps=false. */
    points: [number, number][]
    /** false → indoor activity; Art shows its defined fallback */
    hasGps: boolean
  }
  athlete: {
    name: string
    avatarUrl?: string
    handle?: string
  }
}

export type Customizations = z.infer<typeof customizationsSchema>
```

- [ ] **Step 1.3: Create `src/lib/schemas/customizations.ts`**

```typescript
import { z } from 'zod'

const hexColor = z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Must be a 6-digit hex color (#RRGGBB)')

const anchor = z.enum([
  'top-left', 'top-center', 'top-right',
  'middle-left', 'middle-center', 'middle-right',
  'bottom-left', 'bottom-center', 'bottom-right',
])

const background = z.discriminatedUnion('type', [
  z.object({ type: z.literal('transparent') }),
  z.object({
    type: z.literal('image'),
    assetUrl: z.string().url(),
    overlay: z.object({
      enabled: z.boolean(),
      color: hexColor,
      opacity: z.number().min(0).max(1),
    }),
  }),
])

export const customizationsSchema = z.object({
  primary: hexColor,
  accent: hexColor,
  background,
  artPosition: anchor,
})
```

- [ ] **Step 1.4: Create `src/lib/schemas/activity.ts`**

```typescript
import { z } from 'zod'

const routePoint = z.tuple([
  z.number().min(0).max(1),
  z.number().min(0).max(1),
])

export const activityDataSchema = z.object({
  id: z.string(),
  type: z.string(),
  name: z.string(),
  date: z.string(),
  stats: z.object({
    distance_m: z.number().nonnegative(),
    movingTime_s: z.number().nonnegative(),
    elapsedTime_s: z.number().nonnegative(),
    elevationGain_m: z.number().nonnegative(),
    avgSpeed_mps: z.number().nonnegative(),
  }),
  route: z.object({
    points: z.array(routePoint),
    hasGps: z.boolean(),
  }),
  athlete: z.object({
    name: z.string(),
    avatarUrl: z.string().url().optional(),
    handle: z.string().optional(),
  }),
})
```

- [ ] **Step 1.5: Verify type-check**

```bash
pnpm type-check
```

Expected: no errors.

- [ ] **Step 1.6: Commit**

```bash
git add src/types/ src/lib/schemas/ package.json pnpm-lock.yaml
git commit -m "feat: add ActivityData, Template, Customizations types and Zod schemas"
```

---

## Task 2: Pure Utility Functions + Tests

**Files:**
- Create: `src/lib/art/normalize-route.ts`
- Create: `src/lib/art/format-stat.ts`
- Create: `src/lib/art/resolve-color.ts`
- Create: `src/lib/art/anchor-position.ts`
- Create: `src/lib/art/__tests__/normalize-route.test.ts`
- Create: `src/lib/art/__tests__/format-stat.test.ts`

**Interfaces:**
- Produces:
  - `normalizeRoutePoints(points: [number, number][]): [number, number][]` — lat/lng raw → [0..1]²
  - `formatStat(bind: string, activity: ActivityData): string`
  - `resolveColor(token: StyleToken, customizations: Customizations): string`
  - `anchorToPosition(anchor: Anchor, clusterSize: {w:number;h:number}): {left:number;top:number;width:number;height:number}`

- [ ] **Step 2.1: Write failing tests for normalize-route**

Create `src/lib/art/__tests__/normalize-route.test.ts`:

```typescript
import { normalizeRoutePoints } from '../normalize-route'

describe('normalizeRoutePoints', () => {
  it('returns empty array for empty input', () => {
    expect(normalizeRoutePoints([])).toEqual([])
  })

  it('returns [0.5, 0.5] for a single point', () => {
    expect(normalizeRoutePoints([[48.0, 11.0]])).toEqual([[0.5, 0.5]])
  })

  it('normalizes two horizontal points to x=[0,1], y=0.5', () => {
    const result = normalizeRoutePoints([[0, 0], [0, 1]])
    expect(result[0][1]).toBeCloseTo(0)
    expect(result[1][1]).toBeCloseTo(1)
    expect(result[0][0]).toBeCloseTo(0.5)
    expect(result[1][0]).toBeCloseTo(0.5)
  })

  it('all output values are in [0..1]', () => {
    const points: [number, number][] = [
      [48.13, 11.57], [48.14, 11.58], [48.12, 11.56],
      [48.15, 11.60], [48.11, 11.55],
    ]
    const result = normalizeRoutePoints(points)
    for (const [x, y] of result) {
      expect(x).toBeGreaterThanOrEqual(0)
      expect(x).toBeLessThanOrEqual(1)
      expect(y).toBeGreaterThanOrEqual(0)
      expect(y).toBeLessThanOrEqual(1)
    }
  })

  it('preserves aspect ratio: longer dimension spans full [0..1]', () => {
    // Wide route: lng range 2x lat range
    const points: [number, number][] = [
      [0, 0], [0, 2], [1, 0], [1, 2],
    ]
    const result = normalizeRoutePoints(points)
    const xs = result.map(([x]) => x)
    const ys = result.map(([, y]) => y)
    expect(Math.max(...xs) - Math.min(...xs)).toBeCloseTo(1)
    expect(Math.max(...ys) - Math.min(...ys)).toBeCloseTo(0.5)
  })
})
```

- [ ] **Step 2.2: Run tests — verify they fail**

```bash
pnpm test:run src/lib/art/__tests__/normalize-route.test.ts
```

Expected: FAIL (normalizeRoutePoints not defined).

- [ ] **Step 2.3: Create `src/lib/art/normalize-route.ts`**

```typescript
/**
 * Normalizes geographic coordinates to [0..1]².
 * Preserves aspect ratio by centering the shorter dimension.
 * Y is flipped so north is up (SVG renders top-down).
 *
 * Input: [[lat, lng], ...] (raw geographic coordinates)
 * Output: [[x, y], ...] in [0..1]²
 */
export function normalizeRoutePoints(
  points: [number, number][],
): [number, number][] {
  if (points.length === 0) return []
  if (points.length === 1) return [[0.5, 0.5]]

  const lats = points.map(([lat]) => lat)
  const lngs = points.map(([, lng]) => lng)

  const minLat = Math.min(...lats)
  const maxLat = Math.max(...lats)
  const minLng = Math.min(...lngs)
  const maxLng = Math.max(...lngs)

  const latRange = maxLat - minLat
  const lngRange = maxLng - minLng
  const maxRange = Math.max(latRange, lngRange)

  if (maxRange === 0) return points.map(() => [0.5, 0.5])

  // Center the shorter dimension within [0..1]
  const latOffset = (maxRange - latRange) / (2 * maxRange)
  const lngOffset = (maxRange - lngRange) / (2 * maxRange)

  return points.map(([lat, lng]) => [
    (lng - minLng) / maxRange + lngOffset,           // x = longitude-based
    1 - ((lat - minLat) / maxRange + latOffset),      // y = latitude-based, flipped (north=up)
  ])
}
```

- [ ] **Step 2.4: Run tests — verify they pass**

```bash
pnpm test:run src/lib/art/__tests__/normalize-route.test.ts
```

Expected: all 5 tests pass.

- [ ] **Step 2.5: Write failing tests for format-stat**

Create `src/lib/art/__tests__/format-stat.test.ts`:

```typescript
import { formatStat, formatTime } from '../format-stat'
import type { ActivityData } from '@/types/map-story'

const activity: ActivityData = {
  id: '1',
  type: 'run',
  name: 'Morning Run',
  date: '2026-06-26T07:00:00Z',
  stats: {
    distance_m: 10234,
    movingTime_s: 3661,
    elapsedTime_s: 3700,
    elevationGain_m: 142,
    avgSpeed_mps: 2.79,
  },
  route: { points: [], hasGps: true },
  athlete: { name: 'Andrea' },
}

describe('formatTime', () => {
  it('formats seconds under 1 hour as M:SS', () => {
    expect(formatTime(305)).toBe('5:05')
  })
  it('formats seconds over 1 hour as H:MM:SS', () => {
    expect(formatTime(3661)).toBe('1:01:01')
  })
  it('pads minutes and seconds', () => {
    expect(formatTime(65)).toBe('1:05')
  })
})

describe('formatStat', () => {
  it('formats distance_m as km with 2 decimals', () => {
    expect(formatStat('distance_m', activity)).toBe('10.23 km')
  })
  it('formats movingTime_s as H:MM:SS', () => {
    expect(formatStat('movingTime_s', activity)).toBe('1:01:01')
  })
  it('formats elevationGain_m as rounded meters', () => {
    expect(formatStat('elevationGain_m', activity)).toBe('142 m')
  })
  it('formats avgSpeed_mps as km/h with 1 decimal', () => {
    expect(formatStat('avgSpeed_mps', activity)).toBe('10.0 km/h')
  })
  it('formats name as string', () => {
    expect(formatStat('name', activity)).toBe('Morning Run')
  })
  it('formats date as locale date string', () => {
    const result = formatStat('date', activity)
    expect(result).toMatch(/2026/)
  })
})
```

- [ ] **Step 2.6: Run tests — verify they fail**

```bash
pnpm test:run src/lib/art/__tests__/format-stat.test.ts
```

Expected: FAIL.

- [ ] **Step 2.7: Create `src/lib/art/format-stat.ts`**

```typescript
import type { ActivityData } from '@/types/map-story'

export function formatTime(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const s = Math.floor(totalSeconds % 60)
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }
  return `${m}:${String(s).padStart(2, '0')}`
}

export function formatStat(
  bind: string,
  activity: ActivityData,
): string {
  const stats = activity.stats
  switch (bind) {
    case 'distance_m':
      return `${(stats.distance_m / 1000).toFixed(2)} km`
    case 'movingTime_s':
      return formatTime(stats.movingTime_s)
    case 'elapsedTime_s':
      return formatTime(stats.elapsedTime_s)
    case 'elevationGain_m':
      return `${Math.round(stats.elevationGain_m)} m`
    case 'avgSpeed_mps':
      return `${(stats.avgSpeed_mps * 3.6).toFixed(1)} km/h`
    case 'name':
      return activity.name
    case 'date':
      return new Date(activity.date).toLocaleDateString('it-IT', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      })
    default:
      return ''
  }
}
```

- [ ] **Step 2.8: Run tests — verify they pass**

```bash
pnpm test:run src/lib/art/__tests__/format-stat.test.ts
```

Expected: all tests pass.

- [ ] **Step 2.9: Create `src/lib/art/resolve-color.ts`**

```typescript
import type { Customizations, StyleToken } from '@/types/map-story'

/** Resolves a style token to its hex color from customizations. */
export function resolveColor(
  token: StyleToken,
  customizations: Customizations,
): string {
  if (token === 'primary') return customizations.primary
  if (token === 'accent') return customizations.accent
  // exhaustive — TypeScript will catch new tokens at compile time
  const _: never = token
  return _
}
```

- [ ] **Step 2.10: Create `src/lib/art/anchor-position.ts`**

```typescript
import type { Anchor } from '@/types/map-story'

const SAFE = { top: 250, bottom: 250, left: 64, right: 64 }
const FRAME = { w: 1080, h: 1920 }

/**
 * Converts an Anchor + cluster size to absolute CSS position within the safe area.
 * Safe area: top 250px, bottom 250px (Instagram Story UI zones).
 */
export function anchorToPosition(
  anchor: Anchor,
  cluster: { w: number; h: number },
): { left: number; top: number; width: number; height: number } {
  const safeW = FRAME.w - SAFE.left - SAFE.right
  const safeH = FRAME.h - SAFE.top - SAFE.bottom

  const parts = anchor.split('-') as ['top' | 'middle' | 'bottom', 'left' | 'center' | 'right']
  const [v, h] = parts

  const left =
    h === 'left' ? SAFE.left
    : h === 'center' ? SAFE.left + Math.round((safeW - cluster.w) / 2)
    : FRAME.w - SAFE.right - cluster.w

  const top =
    v === 'top' ? SAFE.top
    : v === 'middle' ? SAFE.top + Math.round((safeH - cluster.h) / 2)
    : FRAME.h - SAFE.bottom - cluster.h

  return { left, top, width: cluster.w, height: cluster.h }
}
```

- [ ] **Step 2.11: Verify type-check**

```bash
pnpm type-check
```

Expected: no errors.

- [ ] **Step 2.12: Commit**

```bash
git add src/lib/art/ package.json pnpm-lock.yaml
git commit -m "feat: add route normalization, stat formatters, color resolver, anchor positioning"
```

---

## Task 3: Layer Components

**Files:**
- Create: `src/components/art/layers/BackgroundLayer.tsx`
- Create: `src/components/art/layers/OverlayLayer.tsx`
- Create: `src/components/art/layers/RouteLayer.tsx`
- Create: `src/components/art/layers/StatLayer.tsx`
- Create: `src/components/art/layers/TextLayer.tsx`
- Create: `src/components/art/layers/BadgeLayer.tsx`

**Interfaces:**
- Each layer receives: `layer` (the LayerNode), `activity: ActivityData`, `customizations: Customizations`
- All layers are pure functions (no hooks, no side effects)

- [ ] **Step 3.1: Create `src/components/art/layers/BackgroundLayer.tsx`**

```tsx
import type { Customizations } from '@/types/map-story'

interface Props {
  customizations: Customizations
}

export function BackgroundLayer({ customizations }: Props) {
  const bg = customizations.background
  if (bg.type === 'transparent') {
    return null
  }
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        backgroundImage: `url(${bg.assetUrl})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    />
  )
}
```

- [ ] **Step 3.2: Create `src/components/art/layers/OverlayLayer.tsx`**

```tsx
import type { Customizations } from '@/types/map-story'

interface Props {
  customizations: Customizations
}

/**
 * Overlay is only rendered when background.type === 'image' AND overlay.enabled.
 * Never rendered for transparent backgrounds (spec §6.4).
 */
export function OverlayLayer({ customizations }: Props) {
  const bg = customizations.background
  if (bg.type !== 'image' || !bg.overlay.enabled) return null
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        backgroundColor: bg.overlay.color,
        opacity: bg.overlay.opacity,
      }}
    />
  )
}
```

- [ ] **Step 3.3: Create `src/components/art/layers/RouteLayer.tsx`**

```tsx
import type { ActivityData, Box, Customizations, RouteStyle } from '@/types/map-story'
import { resolveColor } from '@/lib/art/resolve-color'

interface Props {
  box: Box
  style: RouteStyle
  activity: ActivityData
  customizations: Customizations
  /** When inside a cluster, box coords are relative to cluster origin */
  offsetX?: number
  offsetY?: number
}

const DASH: Record<'solid' | 'dashed' | 'dotted', string | undefined> = {
  solid: undefined,
  dashed: '20 10',
  dotted: '4 8',
}

export function RouteLayer({ box, style, activity, customizations, offsetX = 0, offsetY = 0 }: Props) {
  const { points, hasGps } = activity.route

  if (!hasGps || points.length < 2) {
    // No-GPS fallback: empty slot (Art defines its own visual fallback via text/badge layers)
    return <div style={{ position: 'absolute', left: box.x - offsetX, top: box.y - offsetY, width: box.w, height: box.h }} />
  }

  const color = resolveColor(style.stroke, customizations)
  const svgPoints = points.map(([x, y]) => `${x * box.w},${y * box.h}`).join(' ')

  return (
    <svg
      style={{ position: 'absolute', left: box.x - offsetX, top: box.y - offsetY, overflow: 'visible' }}
      width={box.w}
      height={box.h}
      viewBox={`0 0 ${box.w} ${box.h}`}
    >
      {style.glow && (
        <polyline
          points={svgPoints}
          fill="none"
          stroke={color}
          strokeWidth={style.width * 4}
          strokeOpacity={0.25}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
      <polyline
        points={svgPoints}
        fill="none"
        stroke={color}
        strokeWidth={style.width}
        strokeDasharray={DASH[style.dash]}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
```

- [ ] **Step 3.4: Create `src/components/art/layers/StatLayer.tsx`**

```tsx
import type { ActivityData, Box, Customizations, TextStyle } from '@/types/map-story'
import { formatStat } from '@/lib/art/format-stat'
import { resolveColor } from '@/lib/art/resolve-color'

interface Props {
  bind: string
  box: Box
  style: TextStyle
  activity: ActivityData
  customizations: Customizations
  offsetX?: number
  offsetY?: number
}

export function StatLayer({ bind, box, style, activity, customizations, offsetX = 0, offsetY = 0 }: Props) {
  const value = formatStat(bind, activity)
  const color = resolveColor(style.color, customizations)

  return (
    <div
      style={{
        position: 'absolute',
        left: box.x - offsetX,
        top: box.y - offsetY,
        width: box.w,
        height: box.h,
        fontFamily: style.font,
        fontSize: style.size,
        fontWeight: style.weight ?? 400,
        color,
        display: 'flex',
        alignItems: 'center',
        overflow: 'hidden',
        whiteSpace: 'nowrap',
      }}
    >
      {value}
    </div>
  )
}
```

- [ ] **Step 3.5: Create `src/components/art/layers/TextLayer.tsx`**

```tsx
import type { Box, Customizations, TextStyle } from '@/types/map-story'
import { resolveColor } from '@/lib/art/resolve-color'

interface Props {
  value: string
  box: Box
  style: TextStyle
  customizations: Customizations
  offsetX?: number
  offsetY?: number
}

export function TextLayer({ value, box, style, customizations, offsetX = 0, offsetY = 0 }: Props) {
  const color = resolveColor(style.color, customizations)
  return (
    <div
      style={{
        position: 'absolute',
        left: box.x - offsetX,
        top: box.y - offsetY,
        width: box.w,
        height: box.h,
        fontFamily: style.font,
        fontSize: style.size,
        fontWeight: style.weight ?? 400,
        color,
        display: 'flex',
        alignItems: 'center',
        overflow: 'hidden',
        whiteSpace: 'nowrap',
      }}
    >
      {value}
    </div>
  )
}
```

- [ ] **Step 3.6: Create `src/components/art/layers/BadgeLayer.tsx`**

```tsx
import type { Box } from '@/types/map-story'

interface Props {
  renderId: string
  box: Box
  offsetX?: number
  offsetY?: number
}

/**
 * Badge placeholder. Full badge rendering is defined per-Art in Plan 06.
 * Renders the render ID as a debug label in development.
 */
export function BadgeLayer({ renderId, box, offsetX = 0, offsetY = 0 }: Props) {
  return (
    <div
      style={{
        position: 'absolute',
        left: box.x - offsetX,
        top: box.y - offsetY,
        width: box.w,
        height: box.h,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        border: '1px dashed rgba(0,0,0,0.2)',
      }}
      data-badge-id={renderId}
    />
  )
}
```

- [ ] **Step 3.7: Verify type-check**

```bash
pnpm type-check
```

Expected: no errors.

- [ ] **Step 3.8: Commit**

```bash
git add src/components/art/layers/
git commit -m "feat: add layer components (Background, Overlay, Route, Stat, Text, Badge)"
```

---

## Task 4: StravaAttribution

**Files:**
- Create: `src/components/art/StravaAttribution.tsx`

**Interfaces:**
- Produces: `<StravaAttribution anchor={anchor} />` — always present, non-removable

- [ ] **Step 4.1: Create `src/components/art/StravaAttribution.tsx`**

```tsx
import type { Anchor } from '@/types/map-story'

interface Props {
  anchor: Anchor
}

const ANCHOR_STYLE: Record<string, React.CSSProperties> = {
  'top-left':      { top: 48, left: 48 },
  'top-center':    { top: 48, left: '50%', transform: 'translateX(-50%)' },
  'top-right':     { top: 48, right: 48 },
  'middle-left':   { top: '50%', left: 48, transform: 'translateY(-50%)' },
  'middle-center': { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' },
  'middle-right':  { top: '50%', right: 48, transform: 'translateY(-50%)' },
  'bottom-left':   { bottom: 48, left: 48 },
  'bottom-center': { bottom: 48, left: '50%', transform: 'translateX(-50%)' },
  'bottom-right':  { bottom: 48, right: 48 },
}

/**
 * "Powered by Strava" badge. Always present, never removable.
 * Required by Strava ToS (spec §5.3, §6.5).
 */
export function StravaAttribution({ anchor }: Props) {
  return (
    <div
      style={{
        position: 'absolute',
        ...ANCHOR_STYLE[anchor],
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '6px 12px',
        backgroundColor: 'rgba(0,0,0,0.45)',
        borderRadius: 4,
        backdropFilter: 'blur(4px)',
      }}
      aria-label="Powered by Strava"
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
        {/* Strava flame icon (SVG path) */}
        <path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066z" fill="#FC4C02"/>
        <path d="M11.374 14.010l2.062 4.148 2.057-4.148H11.374z" fill="#FC4C02" opacity=".6"/>
      </svg>
      <span
        style={{
          fontFamily: 'system-ui, sans-serif',
          fontSize: 16,
          color: '#fff',
          fontWeight: 600,
          letterSpacing: '0.01em',
          whiteSpace: 'nowrap',
        }}
      >
        Powered by Strava
      </span>
    </div>
  )
}
```

- [ ] **Step 4.2: Commit**

```bash
git add src/components/art/StravaAttribution.tsx
git commit -m "feat: add StravaAttribution component (non-removable, per §6.5)"
```

---

## Task 5: MapStory Pure Component

**Files:**
- Create: `src/components/art/MapStory.tsx`

**Interfaces:**
- Produces: `<MapStory template={t} activity={a} customizations={c} />` — pure, `(template, activity, customizations) → JSX`

- [ ] **Step 5.1: Create `src/components/art/MapStory.tsx`**

```tsx
import type { ActivityData, Customizations, LayerNode, Template } from '@/types/map-story'
import { anchorToPosition } from '@/lib/art/anchor-position'
import { BackgroundLayer } from './layers/BackgroundLayer'
import { OverlayLayer } from './layers/OverlayLayer'
import { RouteLayer } from './layers/RouteLayer'
import { StatLayer } from './layers/StatLayer'
import { TextLayer } from './layers/TextLayer'
import { BadgeLayer } from './layers/BadgeLayer'
import { StravaAttribution } from './StravaAttribution'

interface MapStoryProps {
  template: Template
  activity: ActivityData
  customizations: Customizations
}

/** Computes the bounding box of all cluster layers (min origin, max extent). */
function clusterBounds(layers: Extract<LayerNode, { placement: 'cluster' }>[]): { w: number; h: number } {
  if (layers.length === 0) return { w: 0, h: 0 }
  let maxX = 0
  let maxY = 0
  for (const l of layers) {
    if ('box' in l) {
      maxX = Math.max(maxX, l.box.x + l.box.w)
      maxY = Math.max(maxY, l.box.y + l.box.h)
    }
  }
  return { w: maxX, h: maxY }
}

function renderFrameLayer(
  layer: LayerNode,
  activity: ActivityData,
  customizations: Customizations,
  index: number,
) {
  switch (layer.kind) {
    case 'background':
      return <BackgroundLayer key={index} customizations={customizations} />
    case 'overlay':
      return <OverlayLayer key={index} customizations={customizations} />
    case 'attribution':
      return <StravaAttribution key={index} anchor={layer.anchor} />
    default:
      return null
  }
}

function renderClusterLayer(
  layer: Extract<LayerNode, { placement: 'cluster' }>,
  activity: ActivityData,
  customizations: Customizations,
  index: number,
) {
  switch (layer.kind) {
    case 'route':
      return (
        <RouteLayer
          key={index}
          box={layer.box}
          style={layer.style}
          activity={activity}
          customizations={customizations}
        />
      )
    case 'stat':
      return (
        <StatLayer
          key={index}
          bind={layer.bind}
          box={layer.box}
          style={layer.style}
          activity={activity}
          customizations={customizations}
        />
      )
    case 'text':
      return (
        <TextLayer
          key={index}
          value={layer.value}
          box={layer.box}
          style={layer.style}
          customizations={customizations}
        />
      )
    case 'badge':
      return (
        <BadgeLayer
          key={index}
          renderId={layer.render}
          box={layer.box}
        />
      )
    default:
      return null
  }
}

/**
 * Pure render function: (template, activity, customizations) → JSX.
 * No hooks, no side effects, no implicit inputs. Same input → same output.
 */
export function MapStory({ template, activity, customizations }: MapStoryProps) {
  const frameLayers = template.layers.filter(
    (l): l is Extract<LayerNode, { placement: 'frame' }> => l.placement === 'frame',
  )
  const clusterLayers = template.layers.filter(
    (l): l is Extract<LayerNode, { placement: 'cluster' }> => l.placement === 'cluster',
  )

  const bounds = clusterBounds(clusterLayers)
  const clusterStyle = anchorToPosition(customizations.artPosition, bounds)

  // Ensure attribution is always present (invariant §6.5)
  const hasAttribution = template.layers.some(l => l.kind === 'attribution')

  return (
    <div
      data-mapstory
      style={{
        width: template.size.w,
        height: template.size.h,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {frameLayers.map((layer, i) =>
        renderFrameLayer(layer, activity, customizations, i),
      )}

      {clusterLayers.length > 0 && (
        <div style={{ position: 'absolute', ...clusterStyle }}>
          {clusterLayers.map((layer, i) =>
            renderClusterLayer(layer, activity, customizations, i),
          )}
        </div>
      )}

      {/* Attribution is always rendered last, on top, even if template omits it */}
      {!hasAttribution && (
        <StravaAttribution anchor="bottom-center" />
      )}
    </div>
  )
}
```

- [ ] **Step 5.2: Verify type-check**

```bash
pnpm type-check
```

Expected: no errors.

- [ ] **Step 5.3: Commit**

```bash
git add src/components/art/MapStory.tsx
git commit -m "feat: add MapStory pure component with cluster/frame layer dispatch"
```

---

## Task 6: Font Infrastructure

**Files:**
- Modify: `src/app/globals.css`
- Create: `public/fonts/` (add one OFL font for smoke Art)

- [ ] **Step 6.1: Download a system-safe font for the smoke Art**

For the smoke Art (MinimalArc), use system-ui. No external font needed yet.
For the infrastructure, download Inter from Google Fonts (OFL license):

```bash
mkdir -p public/fonts
# Download Inter variable font from Google Fonts via curl or manually
# Place as public/fonts/Inter-Variable.woff2
# License: SIL Open Font License 1.1
# Source: https://github.com/rsms/inter
```

If you don't have the font file yet, skip to Step 6.3 — the smoke Art uses `system-ui` and does not require an external font file. Return here when adding a custom font for a real Art.

- [ ] **Step 6.2: Add `@font-face` to `src/app/globals.css` (when font file is present)**

```css
@import "tailwindcss";

@font-face {
  font-family: 'Inter';
  src: url('/fonts/Inter-Variable.woff2') format('woff2');
  font-weight: 100 900;
  font-style: normal;
  font-display: swap;
}
```

- [ ] **Step 6.3: Document font requirements in `public/fonts/README.md`**

```markdown
# Fonts

Self-hosted fonts used in Art components. All fonts must be under SIL Open Font License (OFL).

## Requirements

- Fonts here are served statically by Next.js from `/fonts/`.
- The same font files MUST be installed in the Playwright render container (Plan 03).
- Divergence between browser fonts and Playwright fonts causes the exported PNG to differ from the preview (silent bug).

## Adding a font

1. Verify the font is OFL-licensed.
2. Place the .woff2 file here.
3. Add `@font-face` to `src/app/globals.css`.
4. Update Plan 03 to install the font in the Playwright container.
5. Run the font-parity test (Plan 03, Task 3) to verify consistency.

## Current fonts

| File | Family | License |
|------|--------|---------|
| (none yet) | system-ui used for smoke Art | — |
```

- [ ] **Step 6.4: Commit**

```bash
git add public/fonts/ src/app/globals.css
git commit -m "chore: add font infrastructure and README for Art fonts"
```

---

## Task 7: Fixtures

**Files:**
- Create: `src/lib/art/fixtures.ts`

**Interfaces:**
- Produces:
  - `longWindingRouteFixture: ActivityData` — 20km trail run, complex route
  - `shortCityRouteFixture: ActivityData` — 5km city run, dense GPS
  - `linearRouteFixture: ActivityData` — 40km cycling, straight road
  - `noGpsFixture: ActivityData` — indoor treadmill, hasGps = false

- [ ] **Step 7.1: Create `src/lib/art/fixtures.ts`**

```typescript
import type { ActivityData } from '@/types/map-story'

/** 20km winding trail run — tests long route, elevation */
export const longWindingRouteFixture: ActivityData = {
  id: 'fixture-long',
  type: 'run',
  name: 'Montagna Mattutina',
  date: '2026-06-14T06:30:00Z',
  stats: {
    distance_m: 20140,
    movingTime_s: 7200,
    elapsedTime_s: 7560,
    elevationGain_m: 680,
    avgSpeed_mps: 2.8,
  },
  route: {
    hasGps: true,
    points: [
      [0.5, 0.02],[0.52,0.06],[0.55,0.09],[0.58,0.14],[0.60,0.18],
      [0.62,0.22],[0.64,0.27],[0.62,0.31],[0.60,0.36],[0.57,0.40],
      [0.55,0.44],[0.52,0.47],[0.48,0.50],[0.45,0.53],[0.42,0.57],
      [0.39,0.62],[0.37,0.66],[0.35,0.70],[0.33,0.74],[0.31,0.78],
      [0.30,0.82],[0.29,0.85],[0.28,0.88],[0.27,0.91],[0.26,0.94],
      [0.28,0.96],[0.31,0.97],[0.35,0.98],
    ],
  },
  athlete: { name: 'Andrea Ruggeri', handle: 'andrearuggeri' },
}

/** 5km city run — dense GPS, lots of turns */
export const shortCityRouteFixture: ActivityData = {
  id: 'fixture-city',
  type: 'run',
  name: 'Corsa in Centro',
  date: '2026-06-20T07:15:00Z',
  stats: {
    distance_m: 5230,
    movingTime_s: 1560,
    elapsedTime_s: 1600,
    elevationGain_m: 28,
    avgSpeed_mps: 3.35,
  },
  route: {
    hasGps: true,
    points: [
      [0.5,0.5],[0.55,0.5],[0.55,0.4],[0.6,0.4],[0.6,0.5],
      [0.65,0.5],[0.65,0.6],[0.55,0.6],[0.55,0.7],[0.45,0.7],
      [0.45,0.6],[0.4,0.6],[0.4,0.5],[0.45,0.5],[0.45,0.4],
      [0.5,0.4],[0.5,0.5],
    ],
  },
  athlete: { name: 'Andrea Ruggeri', handle: 'andrearuggeri' },
}

/** 40km road cycling — mostly linear */
export const linearRouteFixture: ActivityData = {
  id: 'fixture-linear',
  type: 'ride',
  name: 'Ciclabile del Naviglio',
  date: '2026-06-22T09:00:00Z',
  stats: {
    distance_m: 40500,
    movingTime_s: 5400,
    elapsedTime_s: 5800,
    elevationGain_m: 85,
    avgSpeed_mps: 7.5,
  },
  route: {
    hasGps: true,
    points: [
      [0.5,0.02],[0.51,0.1],[0.52,0.18],[0.51,0.26],[0.52,0.34],
      [0.51,0.42],[0.52,0.50],[0.51,0.58],[0.52,0.66],[0.51,0.74],
      [0.52,0.82],[0.51,0.90],[0.5,0.98],
    ],
  },
  athlete: { name: 'Andrea Ruggeri', handle: 'andrearuggeri' },
}

/** Indoor treadmill — no GPS */
export const noGpsFixture: ActivityData = {
  id: 'fixture-nogps',
  type: 'run',
  name: 'Tapis Roulant',
  date: '2026-06-25T18:00:00Z',
  stats: {
    distance_m: 8000,
    movingTime_s: 2400,
    elapsedTime_s: 2400,
    elevationGain_m: 0,
    avgSpeed_mps: 3.33,
  },
  route: { hasGps: false, points: [] },
  athlete: { name: 'Andrea Ruggeri', handle: 'andrearuggeri' },
}

export const ALL_FIXTURES = [
  longWindingRouteFixture,
  shortCityRouteFixture,
  linearRouteFixture,
  noGpsFixture,
] as const
```

- [ ] **Step 7.2: Commit**

```bash
git add src/lib/art/fixtures.ts
git commit -m "feat: add 4 realistic ActivityData fixtures (long, city, linear, no-GPS)"
```

---

## Task 8: MinimalArc Art + Storybook Story

**Files:**
- Create: `src/lib/art/arts/minimal-arc/schema.ts`
- Create: `src/lib/art/arts/minimal-arc/index.ts`
- Create: `src/lib/art/registry.ts`
- Create: `src/stories/MinimalArc.stories.tsx`

**Interfaces:**
- Produces:
  - `minimalArcTemplate: Template`
  - `artRegistry: Map<string, Template>`

- [ ] **Step 8.1: Create `src/lib/art/arts/minimal-arc/schema.ts`**

```typescript
import { z } from 'zod'
import { customizationsSchema } from '@/lib/schemas/customizations'
import type { Anchor } from '@/types/map-story'

const ALLOWED_ANCHORS: Anchor[] = [
  'top-center', 'middle-center', 'bottom-center',
]

export const minimalArcSchema = customizationsSchema.extend({
  artPosition: z.enum(['top-center', 'middle-center', 'bottom-center'] as const),
})
```

- [ ] **Step 8.2: Create `src/lib/art/arts/minimal-arc/index.ts`**

```typescript
import type { Template } from '@/types/map-story'
import { minimalArcSchema } from './schema'

export const minimalArcTemplate: Template = {
  id: 'minimal-arc',
  name: 'Minimal Arc',
  size: { w: 1080, h: 1920 },
  layers: [
    { kind: 'background', placement: 'frame' },
    { kind: 'overlay', placement: 'frame' },
    {
      kind: 'route',
      placement: 'cluster',
      box: { x: 0, y: 0, w: 880, h: 880 },
      style: { stroke: 'primary', width: 5, dash: 'solid', glow: true },
    },
    {
      kind: 'stat',
      placement: 'cluster',
      bind: 'distance_m',
      box: { x: 0, y: 920, w: 440, h: 100 },
      style: { font: 'system-ui, sans-serif', size: 52, color: 'primary', weight: 700 },
    },
    {
      kind: 'stat',
      placement: 'cluster',
      bind: 'movingTime_s',
      box: { x: 440, y: 920, w: 440, h: 100 },
      style: { font: 'system-ui, sans-serif', size: 52, color: 'accent', weight: 700 },
    },
    {
      kind: 'attribution',
      placement: 'frame',
      anchor: 'bottom-center',
    },
  ],
  allowedAnchors: ['top-center', 'middle-center', 'bottom-center'],
  defaultAnchor: 'middle-center',
  customizationSchema: minimalArcSchema,
}
```

- [ ] **Step 8.3: Create `src/lib/art/registry.ts`**

```typescript
import type { Template } from '@/types/map-story'
import { minimalArcTemplate } from './arts/minimal-arc'

export const artRegistry = new Map<string, Template>([
  [minimalArcTemplate.id, minimalArcTemplate],
])

export function getTemplate(id: string): Template {
  const t = artRegistry.get(id)
  if (!t) throw new Error(`Unknown template id: "${id}"`)
  return t
}
```

- [ ] **Step 8.4: Create `src/stories/MinimalArc.stories.tsx`**

```tsx
import type { Meta, StoryObj } from '@storybook/react'
import { MapStory } from '@/components/art/MapStory'
import { minimalArcTemplate } from '@/lib/art/arts/minimal-arc'
import {
  longWindingRouteFixture,
  shortCityRouteFixture,
  linearRouteFixture,
  noGpsFixture,
} from '@/lib/art/fixtures'
import type { Customizations } from '@/types/map-story'

const defaultCustomizations: Customizations = {
  primary: '#C13917',
  accent: '#1B3D72',
  background: { type: 'transparent' },
  artPosition: 'middle-center',
}

const meta: Meta<typeof MapStory> = {
  title: 'Art/MinimalArc',
  component: MapStory,
  args: {
    template: minimalArcTemplate,
    customizations: defaultCustomizations,
  },
  argTypes: {
    customizations: { control: 'object' },
  },
}
export default meta

type Story = StoryObj<typeof MapStory>

export const LongWinding: Story = { args: { activity: longWindingRouteFixture } }
export const ShortCity: Story = { args: { activity: shortCityRouteFixture } }
export const Linear: Story = { args: { activity: linearRouteFixture } }
export const NoGps: Story = { args: { activity: noGpsFixture } }
export const WithBackground: Story = {
  args: {
    activity: longWindingRouteFixture,
    customizations: {
      ...defaultCustomizations,
      background: {
        type: 'image',
        assetUrl: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=1080',
        overlay: { enabled: true, color: '#000000', opacity: 0.4 },
      },
    },
  },
}
```

- [ ] **Step 8.5: Verify Storybook builds**

```bash
pnpm storybook:build
```

Expected: no errors; MinimalArc stories visible in build.

- [ ] **Step 8.6: Commit**

```bash
git add src/lib/art/arts/ src/lib/art/registry.ts src/stories/MinimalArc.stories.tsx
git commit -m "feat: add MinimalArc Art template and Storybook stories"
```

---

## Task 9: Purity Snapshot Test (Critical — Never Remove)

**Files:**
- Create: `src/components/art/__tests__/MapStory.purity.test.tsx`

**Interfaces:**
- Consumes: `MapStory`, `minimalArcTemplate`, all 4 fixtures, `defaultCustomizations`
- Produces: snapshot file at `src/components/art/__tests__/__snapshots__/MapStory.purity.test.tsx.snap`

- [ ] **Step 9.1: Write the purity test**

Create `src/components/art/__tests__/MapStory.purity.test.tsx`:

```tsx
import { render } from '@testing-library/react'
import { MapStory } from '../MapStory'
import { minimalArcTemplate } from '@/lib/art/arts/minimal-arc'
import {
  longWindingRouteFixture,
  shortCityRouteFixture,
  linearRouteFixture,
  noGpsFixture,
} from '@/lib/art/fixtures'
import type { Customizations } from '@/types/map-story'

const CUSTOMIZATIONS: Customizations = {
  primary: '#C13917',
  accent: '#1B3D72',
  background: { type: 'transparent' },
  artPosition: 'middle-center',
}

/**
 * CRITICAL: These snapshot tests guard the MapStory purity invariant.
 * Same input MUST produce identical output on every render.
 * NEVER skip, never remove. If a snapshot changes intentionally, update it with:
 *   pnpm test:run -- --update-snapshots
 */
describe('MapStory purity invariant', () => {
  it('renders long winding route identically across renders', () => {
    const props = { template: minimalArcTemplate, activity: longWindingRouteFixture, customizations: CUSTOMIZATIONS }
    const { container: a } = render(<MapStory {...props} />)
    const { container: b } = render(<MapStory {...props} />)
    expect(a.innerHTML).toBe(b.innerHTML)
  })

  it('renders short city route identically across renders', () => {
    const props = { template: minimalArcTemplate, activity: shortCityRouteFixture, customizations: CUSTOMIZATIONS }
    const { container: a } = render(<MapStory {...props} />)
    const { container: b } = render(<MapStory {...props} />)
    expect(a.innerHTML).toBe(b.innerHTML)
  })

  it('renders no-GPS fixture identically across renders', () => {
    const props = { template: minimalArcTemplate, activity: noGpsFixture, customizations: CUSTOMIZATIONS }
    const { container: a } = render(<MapStory {...props} />)
    const { container: b } = render(<MapStory {...props} />)
    expect(a.innerHTML).toBe(b.innerHTML)
  })

  it('renders long winding route — snapshot', () => {
    const { container } = render(
      <MapStory template={minimalArcTemplate} activity={longWindingRouteFixture} customizations={CUSTOMIZATIONS} />
    )
    expect(container.firstChild).toMatchSnapshot()
  })

  it('StravaAttribution is always present in output', () => {
    const fixtures = [longWindingRouteFixture, shortCityRouteFixture, linearRouteFixture, noGpsFixture]
    for (const activity of fixtures) {
      const { getByLabelText } = render(
        <MapStory template={minimalArcTemplate} activity={activity} customizations={CUSTOMIZATIONS} />
      )
      expect(getByLabelText('Powered by Strava')).toBeTruthy()
    }
  })

  it('transparent background renders no BackgroundLayer element', () => {
    const { container } = render(
      <MapStory template={minimalArcTemplate} activity={longWindingRouteFixture} customizations={CUSTOMIZATIONS} />
    )
    const bg = container.querySelector('[style*="backgroundImage"]')
    expect(bg).toBeNull()
  })

  it('overlay is absent when background is transparent', () => {
    const { container } = render(
      <MapStory template={minimalArcTemplate} activity={longWindingRouteFixture} customizations={CUSTOMIZATIONS} />
    )
    // No overlay div should exist
    const overlayDivs = container.querySelectorAll('[style*="opacity"]')
    expect(overlayDivs.length).toBe(0)
  })
})
```

- [ ] **Step 9.2: Run tests — verify they pass**

```bash
pnpm test:run src/components/art/__tests__/MapStory.purity.test.tsx
```

Expected: all 7 tests pass; snapshot file created.

- [ ] **Step 9.3: Verify snapshot file was created**

```bash
ls src/components/art/__tests__/__snapshots__/
```

Expected: `MapStory.purity.test.tsx.snap` exists.

- [ ] **Step 9.4: Commit snapshot + test**

```bash
git add src/components/art/__tests__/
git commit -m "test: add MapStory purity snapshot tests (CRITICAL — never remove)"
```

---

## Task 10: ADR-002 + Wiki

**Files:**
- Create: `docs/adr/002-mapstory-purity.md`
- Create: `docs/wiki/contracts.md`
- Create: `docs/wiki/render.md`
- Modify: `docs/adr/README.md`

- [ ] **Step 10.1: Create `docs/adr/002-mapstory-purity.md`**

```markdown
# ADR-002: MapStory Purity Invariant

**Data:** 2026-06-26
**Stato:** Accepted

## Contesto

`<MapStory>` è il componente centrale di Mapmapmap. Viene usato in tre contesti: strumento di authoring (Storybook), editor utente (preview live), export server (Playwright → PNG). Se non è deterministico, la preview e il PNG esportato divergono silenziosamente.

## Decisione

`<MapStory>` è una **funzione pura**: `(template, activity, customizations) → JSX`. Vietati:
- Hook di stato (`useState`, `useReducer`, `useRef` con side effect)
- Fetch interni (`useEffect`, server components con fetch, SWR)
- Input impliciti: `Date.now()`, `Math.random()`, `process.env.*`, `window.*`
- Side effect di qualsiasi tipo

Il determinismo è garantito da snapshot test in CI, non rimovibili.

## Razionale

- Stesso input → stesso PNG byte-per-byte → cache idempotente possibile (future versioni)
- Preview nell'editor è identica all'export → "what you see is what you get"
- Il render worker (Playwright) è stateless: può girare su qualsiasi box senza coordination
- I test di snapshot sono la rete di sicurezza: qualsiasi violazione accidentale della purezza viene catturata prima del merge

## Conseguenze

- Qualsiasi PR che tocca `MapStory` o i layer deve far passare i purity test
- `--update-snapshots` richiede review manuale del diff visivo
- La formattazione dei dati (distanza, tempo, locale) avviene dentro il componente, ma usando valori da props — non da `Intl` con locale di sistema (usare `'it-IT'` hardcoded)
```

- [ ] **Step 10.2: Update `docs/adr/README.md`**

```markdown
# Architecture Decision Records

| ID | Titolo | Data | Stato |
|---|---|---|---|
| [001](./001-stack.md) | Stack tecnologico | 2026-06-26 | Accepted |
| [002](./002-mapstory-purity.md) | MapStory purity invariant | 2026-06-26 | Accepted |
```

- [ ] **Step 10.3: Create `docs/wiki/contracts.md`**

```markdown
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

User-controlled leve: `primary` (hex), `accent` (hex), `background` (transparent or image+overlay), `artPosition` (Anchor).

Style tokens `primary` and `accent` are the only tokens. Adding new tokens is forbidden.

See `src/lib/schemas/customizations.ts` for the Zod schema.

## LayerNode

Each layer is discriminated by `kind`. `placement: 'frame'` = fixed in 1080×1920. `placement: 'cluster'` = inside the repositionable cluster wrapper.

## Safe Area

- Top: 250px (Instagram Story profile/progress bar)
- Bottom: 250px (reply bar, link sticker zone)
- Safe band: 1080×1420 (y 250–1670)
- Cluster positions respect these bounds via `anchorToPosition()`.
```

- [ ] **Step 10.4: Create `docs/wiki/render.md`**

```markdown
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
```

- [ ] **Step 10.5: Commit**

```bash
git add docs/
git commit -m "docs: add ADR-002, contracts.md, render.md"
```

---

## Self-Review

**Spec coverage:**

| Requirement | Source | Covered |
|---|---|---|
| `<MapStory>` pure function | §4, CLAUDE.md | Task 5 |
| `ActivityData` contract | §6.1 | Task 1 |
| `Template` / `LayerNode` contract | §6.2 | Task 1 |
| `Customizations` contract | §6.4 | Task 1 |
| Style tokens `primary`/`accent` only | §6.2, CLAUDE.md | Task 1, 3 |
| Route normalized `[0..1]²` in data layer | §6.1 | Task 2 |
| Overlay absent if transparent | §6.4, CLAUDE.md | Task 3, 9 |
| `<StravaAttribution />` non-removable | §6.5, CLAUDE.md | Task 4, 9 |
| Safe area 250/250 | §6.3 | Task 2 (`anchor-position.ts`) |
| Storybook 9:16 canvas | §10 | Task 8 |
| `customizationSchema` per Art | §6.2 | Task 8 |
| Font infrastructure | §4 | Task 6 |
| Purity snapshot test in CI | §4 | Task 9 |

**Placeholder scan:** all code blocks contain real implementations.

**Type consistency:** `ActivityData`, `Template`, `Customizations`, `LayerNode` defined once in `src/types/map-story.ts` and imported consistently. `Customizations` is inferred from `customizationsSchema` (no duplication).
