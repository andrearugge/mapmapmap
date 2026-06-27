import type { ActivityData, StatBind } from '@/types/map-story'

/**
 * Formats a duration in seconds as `M:SS` (under 1 hour) or `H:MM:SS`.
 * @param totalSeconds - Non-negative integer seconds
 */
export function formatTime(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const s = Math.floor(totalSeconds % 60)
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }
  return `${m}:${String(s).padStart(2, '0')}`
}

/**
 * Returns a human-readable string for the given stat key on an activity.
 *
 * - Distances: km, 2 decimal places
 * - Speeds: km/h, 1 decimal place
 * - Times: formatted by {@link formatTime}
 * - `name` / `date`: pass-through from `ActivityData`
 */
/**
 * Converts m/s to a running pace string: `M:SS /km`.
 * @param avgSpeedMps - Average speed in metres per second
 */
export function formatPace(avgSpeedMps: number): string {
  const paceSecPerKm = 1000 / avgSpeedMps
  const min = Math.floor(paceSecPerKm / 60)
  const sec = Math.round(paceSecPerKm % 60)
  return `${min}:${String(sec).padStart(2, '0')} /km`
}

/**
 * Returns a human-readable string for the given stat key on an activity.
 *
 * - Distances: km, 2 decimal places
 * - Speeds: km/h (1 dp) or pace min:ss/km when `format === 'pace'`
 * - Times: formatted by {@link formatTime}
 * - `name` / `date`: pass-through from `ActivityData`
 */
export function formatStat(
  bind: StatBind,
  activity: ActivityData,
  format?: string,
): string {
  const stats = activity.stats
  switch (bind) {
    case 'distance_m':
      return `${(stats.distance_m / 1000).toFixed(2)} km`
    case 'movingTime_s':
      return formatTime(stats.movingTime_s)
    case 'elapsedTime_s':
      return formatTime(stats.elapsedTime_s)
    case 'elevationGain_m':
      return `${Math.round(stats.elevationGain_m)} m`
    case 'avgSpeed_mps':
      return format === 'pace'
        ? formatPace(stats.avgSpeed_mps)
        : `${(stats.avgSpeed_mps * 3.6).toFixed(1)} km/h`
    case 'name':
      return activity.name
    case 'date':
      return new Date(activity.date).toLocaleDateString('it-IT', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      })
    default:
      return ''
  }
}
