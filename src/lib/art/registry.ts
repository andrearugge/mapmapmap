import type { Template } from '@/types/map-story'
import { minimalArcTemplate } from './arts/minimal-arc'

/** Registry of all available Art templates, keyed by template ID. */
export const artRegistry = new Map<string, Template>([
  [minimalArcTemplate.id, minimalArcTemplate],
])

/**
 * Returns the template for the given ID.
 * @throws Error if the ID is not registered in `artRegistry`
 */
export function getTemplate(id: string): Template {
  const t = artRegistry.get(id)
  if (!t) throw new Error(`Unknown template id: "${id}"`)
  return t
}
