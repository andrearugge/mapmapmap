/**
 * Normalizes geographic coordinates to [0..1]².
 * Preserves aspect ratio by centering the shorter dimension.
 * Y is flipped so north is up (SVG renders top-down).
 *
 * Input: [[lat, lng], ...] (raw geographic coordinates)
 * Output: [[x, y], ...] in [0..1]²
 */
export function normalizeRoutePoints(
  points: [number, number][],
): [number, number][] {
  if (points.length === 0) return []
  if (points.length === 1) return [[0.5, 0.5]]

  const lats = points.map(([lat]) => lat)
  const lngs = points.map(([, lng]) => lng)

  const minLat = Math.min(...lats)
  const maxLat = Math.max(...lats)
  const minLng = Math.min(...lngs)
  const maxLng = Math.max(...lngs)

  const latRange = maxLat - minLat
  const lngRange = maxLng - minLng
  const maxRange = Math.max(latRange, lngRange)

  if (maxRange === 0) return points.map(() => [0.5, 0.5])

  // Center the shorter dimension within [0..1]
  const latOffset = (maxRange - latRange) / (2 * maxRange)
  const lngOffset = (maxRange - lngRange) / (2 * maxRange)

  return points.map(([lat, lng]) => [
    (lng - minLng) / maxRange + lngOffset,           // x = longitude-based
    1 - ((lat - minLat) / maxRange + latOffset),      // y = latitude-based, flipped (north=up)
  ])
}
