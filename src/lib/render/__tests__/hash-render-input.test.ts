import { describe, it, expect } from 'vitest'
import { hashRenderInput } from '@/lib/render/renderer'
import { longWindingRouteFixture } from '@/lib/art/fixtures'

const baseCustomizations = {
  primary: '#ffffff',
  accent: '#000000',
  background: { type: 'transparent' as const },
  artPosition: 'middle-center' as const,
}

describe('hashRenderInput', () => {
  it('returns a 64-char hex string', () => {
    const hash = hashRenderInput({
      templateId: 'minimal-arc',
      activity: longWindingRouteFixture,
      customizations: baseCustomizations,
    })
    expect(hash).toMatch(/^[a-f0-9]{64}$/)
  })

  it('is deterministic — same input produces same hash', () => {
    const input = { templateId: 'minimal-arc', activity: longWindingRouteFixture, customizations: baseCustomizations }
    expect(hashRenderInput(input)).toBe(hashRenderInput(input))
  })

  it('changes when templateId changes', () => {
    const a = hashRenderInput({ templateId: 'minimal-arc', activity: longWindingRouteFixture, customizations: baseCustomizations })
    const b = hashRenderInput({ templateId: 'other-art', activity: longWindingRouteFixture, customizations: baseCustomizations })
    expect(a).not.toBe(b)
  })

  it('changes when customizations change', () => {
    const a = hashRenderInput({ templateId: 'minimal-arc', activity: longWindingRouteFixture, customizations: baseCustomizations })
    const b = hashRenderInput({
      templateId: 'minimal-arc',
      activity: longWindingRouteFixture,
      customizations: { ...baseCustomizations, primary: '#ff0000' },
    })
    expect(a).not.toBe(b)
  })
})
