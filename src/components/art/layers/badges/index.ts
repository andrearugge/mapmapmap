import type React from 'react'
import type { ActivityData, Customizations } from '@/types/map-story'
import { RoundTechCard } from './RoundTechCard'

export interface BadgeProps {
  activity: ActivityData
  customizations: Customizations
}

export type BadgeComponent = React.ComponentType<BadgeProps>

/** Registry mapping badge render IDs to their React components. */
export const badgeRegistry = new Map<string, BadgeComponent>([
  ['round-tech-card', RoundTechCard],
])
