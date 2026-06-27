import { createHash } from 'node:crypto'
import type { ActivityData, Customizations } from '@/types/map-story'

export type Template = {
  id: string
  name: string
}

export interface Renderer {
  render(input: {
    template: Template
    activity: ActivityData
    customizations: Customizations
  }): Promise<{ png: Buffer; cacheKey: string }>
}

export function hashRenderInput(input: {
  templateId: string
  activity: ActivityData
  customizations: Customizations
}): string {
  const canonical = JSON.stringify({
    templateId: input.templateId,
    activity: input.activity,
    customizations: input.customizations,
  })
  return createHash('sha256').update(canonical).digest('hex')
}
