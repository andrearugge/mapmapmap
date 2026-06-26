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
