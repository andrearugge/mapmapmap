import { describe, it, expect } from 'vitest'
import { activityDataSchema } from '@/lib/schemas/activity'

const validActivity = {
  id: 'act-1',
  type: 'run',
  name: 'Morning Run',
  date: '2026-06-26T07:00:00Z',
  stats: {
    distance_m: 10000,
    movingTime_s: 3600,
    elapsedTime_s: 3700,
    elevationGain_m: 150,
    avgSpeed_mps: 2.78,
  },
  route: {
    points: [[0.1, 0.2], [0.5, 0.5]] as [number, number][],
    hasGps: true,
  },
  athlete: {
    name: 'Test User',
  },
}

describe('activityDataSchema', () => {
  it('parses a valid ActivityData object', () => {
    const result = activityDataSchema.safeParse(validActivity)
    expect(result.success).toBe(true)
  })

  it('rejects missing required id', () => {
    const { id: _id, ...noId } = validActivity
    expect(activityDataSchema.safeParse(noId).success).toBe(false)
  })

  it('rejects non-number distance_m', () => {
    expect(
      activityDataSchema.safeParse({
        ...validActivity,
        stats: { ...validActivity.stats, distance_m: 'ten' },
      }).success,
    ).toBe(false)
  })

  it('parses with optional athlete fields omitted', () => {
    const result = activityDataSchema.safeParse(validActivity)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.athlete.avatarUrl).toBeUndefined()
      expect(result.data.athlete.handle).toBeUndefined()
    }
  })

  it('parses with optional athlete fields present', () => {
    const withOptionals = {
      ...validActivity,
      athlete: {
        name: 'Test',
        avatarUrl: 'https://example.com/avatar.jpg',
        handle: '@test',
      },
    }
    expect(activityDataSchema.safeParse(withOptionals).success).toBe(true)
  })

  it('rejects negative distance_m', () => {
    expect(
      activityDataSchema.safeParse({
        ...validActivity,
        stats: { ...validActivity.stats, distance_m: -1 },
      }).success,
    ).toBe(false)
  })
})
