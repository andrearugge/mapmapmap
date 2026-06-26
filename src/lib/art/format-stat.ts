import type { ActivityData } from '@/types/map-story'

export function formatTime(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const s = Math.floor(totalSeconds % 60)
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }
  return `${m}:${String(s).padStart(2, '0')}`
}

export function formatStat(
  bind: string,
  activity: ActivityData,
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
      return `${(stats.avgSpeed_mps * 3.6).toFixed(1)} km/h`
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
