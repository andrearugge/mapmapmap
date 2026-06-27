import { z } from 'zod'
import { customizationsSchema } from '@/lib/schemas/customizations'
import type { Anchor } from '@/types/map-story'

const ALLOWED_ANCHORS: Anchor[] = ['top-left', 'middle-left', 'bottom-left']

export const roundTechSchema = customizationsSchema.extend({
  artPosition: z.enum(ALLOWED_ANCHORS as [Anchor, ...Anchor[]]),
})
