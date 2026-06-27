import { decodePolyline } from './decode-polyline'

describe('decodePolyline', () => {
  it('decodes empty string to empty array', () => {
    expect(decodePolyline('')).toEqual([])
  })

  it('decodes a known polyline (Google example: Atlanta→Chicago)', () => {
    // Known encoded polyline for [33.8,-84.4], [35.2,-80.2] (approx)
    const encoded = '_p~iF~ps|U_ulLnnqC_mqNvxq`@'
    const result = decodePolyline(encoded)
    expect(result.length).toBe(3)
    expect(result[0][0]).toBeCloseTo(38.5, 0)
    expect(result[0][1]).toBeCloseTo(-120.2, 0)
  })

  it('returns [lat, lng] pairs', () => {
    const encoded = 'u{~vHvgkbBz`@hpb@'
    const result = decodePolyline(encoded)
    expect(result.length).toBeGreaterThan(0)
    for (const [lat, lng] of result) {
      expect(typeof lat).toBe('number')
      expect(typeof lng).toBe('number')
    }
  })
})
