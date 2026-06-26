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
