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
