import type { ActivityData, Box, Customizations } from '@/types/map-story'
import { badgeRegistry } from './badges'

interface Props {
  renderId: string
  box: Box
  activity: ActivityData
  customizations: Customizations
  offsetX?: number
  offsetY?: number
}

export function BadgeLayer({
  renderId,
  box,
  activity,
  customizations,
  offsetX = 0,
  offsetY = 0,
}: Props) {
  const Badge = badgeRegistry.get(renderId)

  return (
    <div
      style={{
        position: 'absolute',
        left: box.x - offsetX,
        top: box.y - offsetY,
        width: box.w,
        height: box.h,
        overflow: 'visible',
      }}
      data-badge-id={renderId}
    >
      {Badge ? (
        <Badge activity={activity} customizations={customizations} />
      ) : (
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '1px dashed rgba(0,0,0,0.2)',
            fontSize: 12,
            color: 'rgba(0,0,0,0.4)',
          }}
        >
          badge: {renderId}
        </div>
      )}
    </div>
  )
}
