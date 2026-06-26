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
