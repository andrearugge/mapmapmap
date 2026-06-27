import { z } from 'zod'
import { activityDataSchema } from '@/lib/schemas/activity'
import { customizationsSchema } from '@/lib/schemas/customizations'

const renderDataSchema = z.object({
  templateId: z.string().min(1),
  activity: activityDataSchema,
  customizations: customizationsSchema,
})

/** Serializable render input passed as a base64url query parameter to the render-frame page. */
export type RenderData = z.infer<typeof renderDataSchema>

/** Encodes RenderData to a URL-safe base64url string for use as a query parameter. */
export function encodeRenderData(data: RenderData): string {
  const json = JSON.stringify(data)
  return Buffer.from(json, 'utf8').toString('base64url')
}

/** Decodes a base64url string back to RenderData; returns null on any decoding or validation error. */
export function decodeRenderData(encoded: string): RenderData | null {
  try {
    const json = Buffer.from(encoded, 'base64url').toString('utf8')
    const parsed: unknown = JSON.parse(json)
    const result = renderDataSchema.safeParse(parsed)
    return result.success ? result.data : null
  } catch {
    return null
  }
}
