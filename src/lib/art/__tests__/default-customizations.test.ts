import { describe, it, expect } from 'vitest'
import { defaultCustomizations } from '@/lib/art/default-customizations'
import { minimalArcTemplate } from '@/lib/art/arts/minimal-arc'
import { customizationsSchema } from '@/lib/schemas/customizations'

describe('defaultCustomizations', () => {
  it('uses template.defaultAnchor as artPosition', () => {
    const result = defaultCustomizations(minimalArcTemplate)
    expect(result.artPosition).toBe(minimalArcTemplate.defaultAnchor)
  })

  it('defaults primary to white (#ffffff)', () => {
    const result = defaultCustomizations(minimalArcTemplate)
    expect(result.primary).toBe('#ffffff')
  })

  it('defaults accent to black (#000000)', () => {
    const result = defaultCustomizations(minimalArcTemplate)
    expect(result.accent).toBe('#000000')
  })

  it('defaults background to transparent', () => {
    const result = defaultCustomizations(minimalArcTemplate)
    expect(result.background).toEqual({ type: 'transparent' })
  })

  it('result passes customizationsSchema validation', () => {
    const result = defaultCustomizations(minimalArcTemplate)
    const parsed = customizationsSchema.safeParse(result)
    expect(parsed.success).toBe(true)
  })
})
