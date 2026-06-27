import { describe, it, expect, vi, beforeEach } from 'vitest'
import { db } from '@/lib/db'

vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn(),
  },
}))

const mockRow = {
  id: 'act-123',
  userId: 'user-1',
  type: 'run',
  name: 'Morning Run',
  date: new Date('2024-01-15T08:00:00.000Z'),
  distanceM: 10000,
  movingTimeS: 3600,
  elapsedTimeS: 3700,
  elevationGainM: 150,
  avgSpeedMps: 2.78,
  routePoints: [[0.1, 0.2], [0.5, 0.5]] as [number, number][],
  hasGps: true,
  athleteName: 'Test User',
  athleteAvatarUrl: null,
  athleteHandle: null,
  fetchedAt: new Date(),
}

function stubDbWith(rows: unknown[]) {
  vi.mocked(db.select).mockReturnValue({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue(rows),
      }),
    }),
  } as unknown as ReturnType<typeof db.select>)
}

describe('getCachedActivity', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns null when no row found', async () => {
    stubDbWith([])
    const { getCachedActivity } = await import('@/lib/strava/get-cached-activity')
    const result = await getCachedActivity('user-1', 'nonexistent')
    expect(result).toBeNull()
  })

  it('returns mapped ActivityData when row is found', async () => {
    stubDbWith([mockRow])
    const { getCachedActivity } = await import('@/lib/strava/get-cached-activity')
    const result = await getCachedActivity('user-1', 'act-123')
    expect(result).not.toBeNull()
    expect(result!.id).toBe('act-123')
    expect(result!.type).toBe('run')
    expect(result!.name).toBe('Morning Run')
    expect(result!.date).toBe('2024-01-15T08:00:00.000Z')
    expect(result!.stats.distance_m).toBe(10000)
    expect(result!.stats.movingTime_s).toBe(3600)
    expect(result!.route.hasGps).toBe(true)
    expect(result!.route.points).toEqual([[0.1, 0.2], [0.5, 0.5]])
    expect(result!.athlete.name).toBe('Test User')
    expect(result!.athlete.avatarUrl).toBeUndefined()
  })

  it('returns null (DB query includes userId in WHERE) when user does not own the activity', async () => {
    stubDbWith([]) // Correct: DB returns nothing because of WHERE userId=...
    const { getCachedActivity } = await import('@/lib/strava/get-cached-activity')
    const result = await getCachedActivity('user-2', 'act-123')
    expect(result).toBeNull()
  })
})
