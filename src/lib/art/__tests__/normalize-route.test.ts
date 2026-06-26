import { normalizeRoutePoints } from '../normalize-route'

describe('normalizeRoutePoints', () => {
  it('returns empty array for empty input', () => {
    expect(normalizeRoutePoints([])).toEqual([])
  })

  it('returns [0.5, 0.5] for a single point', () => {
    expect(normalizeRoutePoints([[48.0, 11.0]])).toEqual([[0.5, 0.5]])
  })

  it('normalizes two horizontal points to x=[0,1], y=0.5', () => {
    const result = normalizeRoutePoints([[0, 0], [0, 1]])
    expect(result[0][0]).toBeCloseTo(0)
    expect(result[1][0]).toBeCloseTo(1)
    expect(result[0][1]).toBeCloseTo(0.5)
    expect(result[1][1]).toBeCloseTo(0.5)
  })

  it('all output values are in [0..1]', () => {
    const points: [number, number][] = [
      [48.13, 11.57], [48.14, 11.58], [48.12, 11.56],
      [48.15, 11.60], [48.11, 11.55],
    ]
    const result = normalizeRoutePoints(points)
    for (const [x, y] of result) {
      expect(x).toBeGreaterThanOrEqual(0)
      expect(x).toBeLessThanOrEqual(1)
      expect(y).toBeGreaterThanOrEqual(0)
      expect(y).toBeLessThanOrEqual(1)
    }
  })

  it('preserves aspect ratio: longer dimension spans full [0..1]', () => {
    // Wide route: lng range 2x lat range
    const points: [number, number][] = [
      [0, 0], [0, 2], [1, 0], [1, 2],
    ]
    const result = normalizeRoutePoints(points)
    const xs = result.map(([x]) => x)
    const ys = result.map(([, y]) => y)
    expect(Math.max(...xs) - Math.min(...xs)).toBeCloseTo(1)
    expect(Math.max(...ys) - Math.min(...ys)).toBeCloseTo(0.5)
  })
})
