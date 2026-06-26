import type { OAuthConfig, OAuthUserConfig } from 'next-auth/providers'

/** Shape returned by GET https://www.strava.com/api/v3/athlete */
export interface StravaProfile {
  id: number
  firstname: string
  lastname: string
  profile_medium: string
  username: string | null
}

export function StravaProvider(
  config: OAuthUserConfig<StravaProfile>,
): OAuthConfig<StravaProfile> {
  return {
    id: 'strava',
    name: 'Strava',
    type: 'oauth',
    authorization: {
      url: 'https://www.strava.com/oauth/authorize',
      params: {
        scope: 'activity:read',
        response_type: 'code',
        approval_prompt: 'auto',
      },
    },
    token: 'https://www.strava.com/oauth/token',
    userinfo: 'https://www.strava.com/api/v3/athlete',
    profile(profile: StravaProfile) {
      return {
        id: String(profile.id),
        name: `${profile.firstname} ${profile.lastname}`.trim(),
        email: null, // Strava does not provide email
        image: profile.profile_medium,
        stravaAthleteId: String(profile.id),
        handle: profile.username ?? null,
      }
    },
    ...config,
  } as OAuthConfig<StravaProfile>
}
