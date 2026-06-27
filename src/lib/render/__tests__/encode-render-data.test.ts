import { describe, it, expect } from 'vitest'
import { encodeRenderData, decodeRenderData } from '@/lib/render/encode-render-data'
import { longWindingRouteFixture } from '@/lib/art/fixtures'
import type { RenderData } from '@/lib/render/encode-render-data'

const sample: RenderData = {
  templateId: 'minimal-arc',
  activity: longWindingRouteFixture,
  customizations: {
    primary: '#ffffff',
    accent: '#ff5500',
    background: { type: 'transparent' },
    artPosition: 'middle-center',
  },
}

describe('encodeRenderData / decodeRenderData', () => {
  it('roundtrip: decode(encode(x)) deep-equals x', () => {
    const encoded = encodeRenderData(sample)
    const decoded = decodeRenderData(encoded)
    expect(decoded).toEqual(sample)
  })

  it('encoded string contains no whitespace', () => {
    const encoded = encodeRenderData(sample)
    expect(encoded).not.toMatch(/\s/)
  })

  it('decodeRenderData returns null for empty string', () => {
    expect(decodeRenderData('')).toBeNull()
  })

  it('decodeRenderData returns null for invalid base64', () => {
    expect(decodeRenderData('!!!not-base64!!!')).toBeNull()
  })

  it('decodeRenderData returns null for valid base64 but invalid schema', () => {
    const bad = Buffer.from(JSON.stringify({ foo: 'bar' })).toString('base64url')
    expect(decodeRenderData(bad)).toBeNull()
  })
})
