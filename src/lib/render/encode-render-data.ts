import { z } from 'zod'
import { activityDataSchema } from '@/lib/schemas/activity'
import { customizationsSchema } from '@/lib/schemas/customizations'

const renderDataSchema = z.object({
  templateId: z.string().min(1),
  activity: activityDataSchema,
  customizations: customizationsSchema,
})

export type RenderData = z.infer<typeof renderDataSchema>

export function encodeRenderData(data: RenderData): string {
  const json = JSON.stringify(data)
  return Buffer.from(json, 'utf8').toString('base64url')
}

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
