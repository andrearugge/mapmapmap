import { z } from 'zod'
import { customizationsSchema } from '@/lib/schemas/customizations'
import type { Anchor } from '@/types/map-story'

const ALLOWED_ANCHORS: Anchor[] = [
  'top-center', 'middle-center', 'bottom-center',
]

export const minimalArcSchema = customizationsSchema.extend({
  artPosition: z.enum(['top-center', 'middle-center', 'bottom-center'] as const),
})
