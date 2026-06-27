---
doc-map:
  areas: [src/auth.ts, src/lib/auth/, src/lib/strava/, src/middleware.ts, src/app/(user)/]
  last-updated: 2026-06-26
  updated-by: plan-04-strava-auth
---

# Auth & Strava Integration

## OAuth Flow

1. User clicks "Connect with Strava" → `signIn('strava')` → Strava OAuth
2. Auth.js receives `access_token`, `refresh_token`, `expires_at` from Strava
3. Tokens are encrypted with AES-256-GCM before being written to `accounts` table
4. Session created in DB; user redirected to `/activity-picker`

## Token Encryption

`src/lib/auth/token-crypto.ts` — AES-256-GCM, key derived from `AUTH_SECRET` via scrypt.
Format: `[IV 16B][auth tag 16B][ciphertext]` → base64.
Key derivation salt: `'mapmapmap-token-v1'`.

## Proactive Token Refresh

Strava tokens expire every 6 hours. On every session access, the `session` callback in `src/auth.ts`:
1. Fetches the account record
2. Checks `expiresAt - now < 1800s` (30 min threshold)
3. If close to expiry: decrypts refresh token, POSTs to `https://www.strava.com/oauth/token`, encrypts and stores new tokens

This is transparent to the user — no manual re-auth needed.

## Activity Cache

Activities are fetched lazily from Strava API (only when the user opens the picker, not at login).
Cached in the `activities` table with `fetched_at`. Cache TTL: 12 hours.

Pipeline per activity:
1. Fetch `summary_polyline` from Strava (already trimmed of privacy zones)
2. Decode via Google Encoded Polyline algorithm (`decode-polyline.ts`)
3. Normalize to `[0..1]²` via `normalizeRoutePoints()` (from Plan 02)
4. Upsert into `activities` table
5. Filter GPS activities (`hasGps = true`) in the picker

## Route Protection

`src/middleware.ts` guards:
- `/(user)/*` routes: redirect to `/` if no session
- `/admin/*` routes: redirect to `/` if no session (role check in admin layout)

## Rate Limits

Strava: 200 req/15 min, 1000/day (reads). Mitigated by:
- Lazy fetch (no request at login)
- 12-hour cache TTL
- Single fetch per user session, not per page load
