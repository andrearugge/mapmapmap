import type { Customizations, StyleToken } from '@/types/map-story'

/** Resolves a style token to its hex color from customizations. */
export function resolveColor(
  token: StyleToken,
  customizations: Customizations,
): string {
  if (token === 'primary') return customizations.primary
  if (token === 'accent') return customizations.accent
  // exhaustive — TypeScript will catch new tokens at compile time
  const _: never = token
  return _
}
