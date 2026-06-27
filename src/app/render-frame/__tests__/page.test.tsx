import { describe, it, expect, vi } from 'vitest'
import { decodeRenderData, encodeRenderData } from '@/lib/render/encode-render-data'
import { longWindingRouteFixture } from '@/lib/art/fixtures'

// We test the encode/decode behavior that the page depends on.
// The page itself is a Server Component; visual correctness is verified via Storybook + manual run.
describe('render-frame page inputs', () => {
  it('encodes and decodes a valid render payload', () => {
    const data = {
      templateId: 'minimal-arc',
      activity: longWindingRouteFixture,
      customizations: {
        primary: '#ffffff',
        accent: '#ff5500',
        background: { type: 'transparent' as const },
        artPosition: 'middle-center' as const,
      },
    }
    const encoded = encodeRenderData(data)
    expect(decodeRenderData(encoded)).toEqual(data)
  })

  it('decodeRenderData returns null for a tampered token', () => {
    const data = {
      templateId: 'minimal-arc',
      activity: longWindingRouteFixture,
      customizations: {
        primary: '#ffffff',
        accent: '#ff5500',
        background: { type: 'transparent' as const },
        artPosition: 'middle-center' as const,
      },
    }
    const encoded = encodeRenderData(data)
    const tampered = encoded.slice(0, -4) + 'AAAA'
    expect(decodeRenderData(tampered)).toBeNull()
  })
})
