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
