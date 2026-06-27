import { eq, desc } from 'drizzle-orm'
import { sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { activities } from '@/lib/db/schema'
import { decryptToken } from '@/lib/auth/token-crypto'
import { getStravaActivities } from './client'
import { decodePolyline } from './decode-polyline'
import { normalizeRoutePoints } from '@/lib/art/normalize-route'
import type { ActivityData } from '@/types/map-story'

const CACHE_TTL_HOURS = 12

function isCacheStale(fetchedAt: Date): boolean {
  const ageMs = Date.now() - fetchedAt.getTime()
  return ageMs > CACHE_TTL_HOURS * 60 * 60 * 1000
}

function dbRowToActivityData(row: typeof activities.$inferSelect): ActivityData {
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

/**
 * Returns cached activities for a user, or fetches from Strava if cache is empty/stale.
 * Lazy: only called when the user opens the activity picker.
 *
 * @param userId - Internal app user ID
 * @param encryptedAccessToken - AES-256-GCM encrypted Strava access token (from DB)
 * @returns Up to 30 activities normalized to {@link ActivityData}
 */
export async function getOrFetchActivities(
  userId: string,
  encryptedAccessToken: string,
): Promise<ActivityData[]> {
  // Check cache
  const cached = await db
    .select()
    .from(activities)
    .where(eq(activities.userId, userId))
    .orderBy(desc(activities.date))
    .limit(50)

  if (cached.length > 0 && !isCacheStale(cached[0].fetchedAt)) {
    return cached.map(dbRowToActivityData)
  }

  // Fetch from Strava
  const accessToken = decryptToken(encryptedAccessToken)
  const stravaActivities = await getStravaActivities(accessToken)

  // Normalize and prepare rows for upsert
  const rows = stravaActivities.map((sa) => {
    const polyline = sa.map.summary_polyline ?? ''
    const latLng = polyline ? decodePolyline(polyline) : []
    const normalizedPoints = latLng.length >= 2 ? normalizeRoutePoints(latLng) : []
    const hasGps = normalizedPoints.length >= 2

    return {
      id: String(sa.id),
      userId,
      type: sa.sport_type ?? sa.type,
      name: sa.name,
      date: new Date(sa.start_date),
      distanceM: Math.round(sa.distance),
      movingTimeS: sa.moving_time,
      elapsedTimeS: sa.elapsed_time,
      elevationGainM: Math.round(sa.total_elevation_gain),
      avgSpeedMps: sa.average_speed,
      routePoints: normalizedPoints as [number, number][],
      hasGps,
      athleteName: `${sa.athlete.firstname} ${sa.athlete.lastname}`.trim(),
      athleteAvatarUrl: sa.athlete.profile_medium || null,
      athleteHandle: sa.athlete.username || null,
    }
  })

  // Upsert: insert or update existing cache rows
  if (rows.length > 0) {
    await db
      .insert(activities)
      .values(rows)
      .onConflictDoUpdate({
        target: activities.id,
        set: {
          name: sql`excluded.name`,
          date: sql`excluded.date`,
          routePoints: sql`excluded.route_points`,
          hasGps: sql`excluded.has_gps`,
          fetchedAt: sql`now()`,
        },
      })
  }

  return rows.map((r) => ({
    id: r.id,
    type: r.type,
    name: r.name,
    date: r.date.toISOString(),
    stats: {
      distance_m: r.distanceM,
      movingTime_s: r.movingTimeS,
      elapsedTime_s: r.elapsedTimeS,
      elevationGain_m: r.elevationGainM,
      avgSpeed_mps: r.avgSpeedMps,
    },
    route: { points: r.routePoints, hasGps: r.hasGps },
    athlete: {
      name: r.athleteName,
      avatarUrl: r.athleteAvatarUrl ?? undefined,
      handle: r.athleteHandle ?? undefined,
    },
  }))
}
