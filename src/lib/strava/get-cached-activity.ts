import { and, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { activities } from '@/lib/db/schema'
import type { ActivityData } from '@/types/map-story'

/**
 * Retrieves a single cached activity by ID and userId.
 *
 * @param userId - The user ID that owns the activity
 * @param activityId - The Strava activity ID
 * @returns The activity data, or null if not found or user does not own it
 */
export async function getCachedActivity(
  userId: string,
  activityId: string,
): Promise<ActivityData | null> {
  const [row] = await db
    .select()
    .from(activities)
    .where(and(eq(activities.id, activityId), eq(activities.userId, userId)))
    .limit(1)

  if (!row) return null

  return {
    id: row.id,
    type: row.type,
    name: row.name,
    date: row.date.toISOString(),
    stats: {
      distance_m: row.distanceM,
      movingTime_s: row.movingTimeS,
      elapsedTime_s: row.elapsedTimeS,
      elevationGain_m: row.elevationGainM,
      avgSpeed_mps: row.avgSpeedMps,
    },
    route: {
      points: row.routePoints,
      hasGps: row.hasGps,
    },
    athlete: {
      name: row.athleteName,
      avatarUrl: row.athleteAvatarUrl ?? undefined,
      handle: row.athleteHandle ?? undefined,
    },
  }
}
