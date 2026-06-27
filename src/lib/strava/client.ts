const STRAVA_API = 'https://www.strava.com/api/v3'
const PER_PAGE = 30 // activities per fetch page

export interface StravaActivity {
  id: number
  name: string
  type: string
  sport_type: string
  start_date: string
  distance: number
  moving_time: number
  elapsed_time: number
  total_elevation_gain: number
  average_speed: number
  map: {
    summary_polyline: string | null
  }
  athlete: {
    id: number
    firstname: string
    lastname: string
    profile_medium: string
    username: string | null
  }
}

/**
 * Fetches activities from Strava API.
 * Uses summary_polyline (already trimmed of privacy zones by Strava).
 * Only returns activities with a non-empty polyline (hasGps).
 */
export async function getStravaActivities(
  accessToken: string,
  page = 1,
): Promise<StravaActivity[]> {
  const url = new URL(`${STRAVA_API}/athlete/activities`)
  url.searchParams.set('per_page', String(PER_PAGE))
  url.searchParams.set('page', String(page))

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
    // Next.js: no-store to avoid stale cache
    cache: 'no-store',
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Strava API error ${res.status}: ${body}`)
  }

  return res.json() as Promise<StravaActivity[]>
}
