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
