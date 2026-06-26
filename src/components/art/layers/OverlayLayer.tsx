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
