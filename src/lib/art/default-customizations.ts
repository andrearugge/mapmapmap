import type { Template, Customizations } from '@/types/map-story'

/**
 * Produces default customizations for a template.
 *
 * @param template The template whose defaultAnchor will be used as artPosition
 * @returns A Customizations object with white primary, black accent, transparent background
 */
export function defaultCustomizations(template: Template): Customizations {
  return {
    primary: '#ffffff',
    accent: '#000000',
    background: { type: 'transparent' },
    artPosition: template.defaultAnchor,
  }
}
