import { z } from 'zod'

const hexColor = z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Must be a 6-digit hex color (#RRGGBB)')

const anchor = z.enum([
  'top-left', 'top-center', 'top-right',
  'middle-left', 'middle-center', 'middle-right',
  'bottom-left', 'bottom-center', 'bottom-right',
])

const background = z.discriminatedUnion('type', [
  z.object({ type: z.literal('transparent') }),
  z.object({
    type: z.literal('image'),
    assetUrl: z.string().url(),
    overlay: z.object({
      enabled: z.boolean(),
      color: hexColor,
      opacity: z.number().min(0).max(1),
    }),
  }),
])

export const customizationsSchema = z.object({
  primary: hexColor,
  accent: hexColor,
  background,
  artPosition: anchor,
})
