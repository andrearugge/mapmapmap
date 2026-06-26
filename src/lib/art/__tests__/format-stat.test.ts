import { formatStat, formatTime } from '../format-stat'
import type { ActivityData } from '@/types/map-story'

const activity: ActivityData = {
  id: '1',
  type: 'run',
  name: 'Morning Run',
  date: '2026-06-26T07:00:00Z',
  stats: {
    distance_m: 10234,
    movingTime_s: 3661,
    elapsedTime_s: 3700,
    elevationGain_m: 142,
    avgSpeed_mps: 2.79,
  },
  route: { points: [], hasGps: true },
  athlete: { name: 'Andrea' },
}

describe('formatTime', () => {
  it('formats seconds under 1 hour as M:SS', () => {
    expect(formatTime(305)).toBe('5:05')
  })
  it('formats seconds over 1 hour as H:MM:SS', () => {
    expect(formatTime(3661)).toBe('1:01:01')
  })
  it('pads minutes and seconds', () => {
    expect(formatTime(65)).toBe('1:05')
  })
})

describe('formatStat', () => {
  it('formats distance_m as km with 2 decimals', () => {
    expect(formatStat('distance_m', activity)).toBe('10.23 km')
  })
  it('formats movingTime_s as H:MM:SS', () => {
    expect(formatStat('movingTime_s', activity)).toBe('1:01:01')
  })
  it('formats elevationGain_m as rounded meters', () => {
    expect(formatStat('elevationGain_m', activity)).toBe('142 m')
  })
  it('formats avgSpeed_mps as km/h with 1 decimal', () => {
    expect(formatStat('avgSpeed_mps', activity)).toBe('10.0 km/h')
  })
  it('formats name as string', () => {
    expect(formatStat('name', activity)).toBe('Morning Run')
  })
  it('formats date as locale date string', () => {
    const result = formatStat('date', activity)
    expect(result).toMatch(/2026/)
    expect(result).not.toBe('2026-06-26T07:00:00Z') // not raw ISO
    expect(result.length).toBeGreaterThan(8) // longer than just the year
  })
})
