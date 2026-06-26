import type { Template } from '@/types/map-story'
import { minimalArcTemplate } from './arts/minimal-arc'

export const artRegistry = new Map<string, Template>([
  [minimalArcTemplate.id, minimalArcTemplate],
])

export function getTemplate(id: string): Template {
  const t = artRegistry.get(id)
  if (!t) throw new Error(`Unknown template id: "${id}"`)
  return t
}
