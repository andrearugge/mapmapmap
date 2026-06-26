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
