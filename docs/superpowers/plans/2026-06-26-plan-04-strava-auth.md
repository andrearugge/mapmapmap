# Plan 04 — Strava Auth + Activity Cache

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete Strava OAuth (token encryption at rest, proactive 6h refresh), middleware route protection, Strava API client, polyline decoder, activity cache in DB, and activity picker component (GPS-only, paginated).

**Architecture:** Auth.js v5 session callback handles proactive token refresh when `expiresAt` is within 30 minutes. Tokens (access + refresh) are AES-256-GCM encrypted before writing to `accounts.refresh_token` / `accounts.access_token`. Activity data is fetched lazily (only on picker open), normalized (polyline decode → `[0..1]²`), and cached in the `activities` table — never re-fetched if already cached. The picker filters out non-GPS activities client-side.

**Tech Stack:** Node.js `crypto` (built-in, no extra deps), Drizzle ORM, Auth.js v5. All from Plan 01.

## Global Constraints

- Strava OAuth scope: `activity:read` — never `activity:read_all`
- Tokens MUST be encrypted before writing to DB
- Activity fetch is LAZY — never at login, only when picker opens
- Strava data MUST NOT appear in admin analytics (spec §5.3)
- Rate limit awareness: 200 req/15 min, 1000/day for reads — always check cache before fetching

## Dependencies

- **Plan 01** must be complete (Auth.js skeleton, Drizzle schema, DB migration infrastructure)
- **Plan 02** must be complete for Task 7 (uses `normalizeRoutePoints` from `src/lib/art/normalize-route.ts`)

Tasks 1–6 can run before Plan 02. Task 7 (activity cache with normalization) requires Plan 02.

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Modify | `src/lib/db/schema.ts` | Add `activities` table |
| Create | `src/lib/auth/token-crypto.ts` | AES-256-GCM encrypt/decrypt |
| Create | `src/lib/auth/token-crypto.test.ts` | Unit tests for encryption |
| Modify | `src/lib/auth/strava-provider.ts` | No change needed (skeleton already correct) |
| Modify | `src/auth.ts` | Add token encryption + proactive refresh in callbacks |
| Create | `src/middleware.ts` | Route protection + admin guard |
| Create | `src/lib/strava/client.ts` | Strava API fetch wrapper |
| Create | `src/lib/strava/decode-polyline.ts` | Google Encoded Polyline decoder |
| Create | `src/lib/strava/decode-polyline.test.ts` | Unit tests for decoder |
| Create | `src/lib/strava/activity-cache.ts` | Fetch + normalize + cache DB operations |
| Create | `src/app/(user)/activity-picker/page.tsx` | Activity picker route |
| Create | `src/components/user/ActivityPicker.tsx` | Picker component (GPS filter, pagination) |
| Create | `src/app/(user)/layout.tsx` | Protected layout for user area |
| Create | `docs/wiki/auth.md` | Auth flow, token management, activity cache |

---

## Task 1: Activities Table in DB Schema

**Files:**
- Modify: `src/lib/db/schema.ts`

**Interfaces:**
- Produces: `activities` table — `import { activities } from '@/lib/db/schema'`

- [ ] **Step 1.1: Add `activities` table to `src/lib/db/schema.ts`**

Add to the existing schema file (after the `sessions` table):

```typescript
import { boolean, json } from 'drizzle-orm/pg-core'
// Add to existing imports at top of schema.ts

export const activities = pgTable('activities', {
  id: text('id').primaryKey(), // Strava activity ID as string
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  type: text('type').notNull(),
  name: text('name').notNull(),
  date: timestamp('date', { withTimezone: true }).notNull(),
  distanceM: integer('distance_m').notNull().default(0),
  movingTimeS: integer('moving_time_s').notNull().default(0),
  elapsedTimeS: integer('elapsed_time_s').notNull().default(0),
  elevationGainM: integer('elevation_gain_m').notNull().default(0),
  avgSpeedMps: real('avg_speed_mps').notNull().default(0),
  // Normalized route points [0..1]² — stored as JSON array of [x,y] pairs
  routePoints: json('route_points').$type<[number, number][]>().notNull().default([]),
  hasGps: boolean('has_gps').notNull().default(false),
  athleteName: text('athlete_name').notNull(),
  athleteAvatarUrl: text('athlete_avatar_url'),
  athleteHandle: text('athlete_handle'),
  fetchedAt: timestamp('fetched_at', { withTimezone: true }).notNull().defaultNow(),
})
```

Note: also add `real` to the `drizzle-orm/pg-core` import at the top of schema.ts.

- [ ] **Step 1.2: Generate migration**

```bash
pnpm db:generate
```

Expected: new migration file in `src/lib/db/migrations/0001_*.sql` with `CREATE TABLE activities`.

- [ ] **Step 1.3: Run migration**

```bash
pnpm db:migrate
```

Expected: `All migrations ran successfully.`

- [ ] **Step 1.4: Verify type-check**

```bash
pnpm type-check
```

Expected: no errors.

- [ ] **Step 1.5: Commit**

```bash
git add src/lib/db/schema.ts src/lib/db/migrations/
git commit -m "feat: add activities table to DB schema"
```

---

## Task 2: Token Encryption

**Files:**
- Create: `src/lib/auth/token-crypto.ts`
- Create: `src/lib/auth/token-crypto.test.ts`

**Interfaces:**
- Produces:
  - `encryptToken(plaintext: string): string` — returns base64-encoded ciphertext
  - `decryptToken(ciphertext: string): string` — returns plaintext

- [ ] **Step 2.1: Write failing tests**

Create `src/lib/auth/token-crypto.test.ts`:

```typescript
import { encryptToken, decryptToken } from './token-crypto'

// Set AUTH_SECRET for tests
process.env.AUTH_SECRET = 'test-secret-must-be-at-least-32-chars-long!!'

describe('token-crypto', () => {
  it('round-trips a token', () => {
    const original = 'strava_access_token_abc123'
    const encrypted = encryptToken(original)
    expect(decryptToken(encrypted)).toBe(original)
  })

  it('produces different ciphertext for the same plaintext (random IV)', () => {
    const token = 'same_token'
    const a = encryptToken(token)
    const b = encryptToken(token)
    expect(a).not.toBe(b)
    // But both decrypt to the same value
    expect(decryptToken(a)).toBe(token)
    expect(decryptToken(b)).toBe(token)
  })

  it('throws when AUTH_SECRET is not set', () => {
    const original = process.env.AUTH_SECRET
    delete process.env.AUTH_SECRET
    expect(() => encryptToken('anything')).toThrow('AUTH_SECRET')
    process.env.AUTH_SECRET = original
  })

  it('throws on tampered ciphertext', () => {
    const encrypted = encryptToken('real_token')
    const tampered = encrypted.slice(0, -4) + 'XXXX'
    expect(() => decryptToken(tampered)).toThrow()
  })
})
```

- [ ] **Step 2.2: Run tests — verify they fail**

```bash
pnpm test:run src/lib/auth/token-crypto.test.ts
```

Expected: FAIL (module not found).

- [ ] **Step 2.3: Create `src/lib/auth/token-crypto.ts`**

```typescript
import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scryptSync,
} from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const IV_BYTES = 16
const TAG_BYTES = 16
const KEY_BYTES = 32
const SALT = 'mapmapmap-token-v1'

function deriveKey(): Buffer {
  const secret = process.env.AUTH_SECRET
  if (!secret) throw new Error('AUTH_SECRET environment variable is not set')
  return scryptSync(secret, SALT, KEY_BYTES)
}

/**
 * Encrypts a token string with AES-256-GCM.
 * Output format (base64): [IV (16 bytes)][auth tag (16 bytes)][ciphertext]
 */
export function encryptToken(plaintext: string): string {
  const iv = randomBytes(IV_BYTES)
  const key = deriveKey()
  const cipher = createCipheriv(ALGORITHM, key, iv)
  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ])
  const tag = cipher.getAuthTag()
  return Buffer.concat([iv, tag, encrypted]).toString('base64')
}

/**
 * Decrypts a token string produced by encryptToken.
 * Throws if the ciphertext has been tampered with.
 */
export function decryptToken(ciphertext: string): string {
  const buf = Buffer.from(ciphertext, 'base64')
  const iv = buf.subarray(0, IV_BYTES)
  const tag = buf.subarray(IV_BYTES, IV_BYTES + TAG_BYTES)
  const encrypted = buf.subarray(IV_BYTES + TAG_BYTES)
  const key = deriveKey()
  const decipher = createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString(
    'utf8',
  )
}
```

- [ ] **Step 2.4: Run tests — verify they pass**

```bash
pnpm test:run src/lib/auth/token-crypto.test.ts
```

Expected: all 4 tests pass.

- [ ] **Step 2.5: Commit**

```bash
git add src/lib/auth/token-crypto.ts src/lib/auth/token-crypto.test.ts
git commit -m "feat: add AES-256-GCM token encryption for Strava tokens at rest"
```

---

## Task 3: Auth.js Complete (Encryption + Proactive Refresh)

**Files:**
- Modify: `src/auth.ts`

**Interfaces:**
- Produces: `auth()`, `signIn()`, `signOut()` with full token lifecycle management

- [ ] **Step 3.1: Replace `src/auth.ts` with complete implementation**

```typescript
import NextAuth from 'next-auth'
import { DrizzleAdapter } from '@auth/drizzle-adapter'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { accounts, sessions, users } from '@/lib/db/schema'
import { StravaProvider } from '@/lib/auth/strava-provider'
import { encryptToken, decryptToken } from '@/lib/auth/token-crypto'

const REFRESH_THRESHOLD_S = 30 * 60 // refresh if token expires within 30 min

async function refreshStravaToken(
  account: typeof accounts.$inferSelect,
): Promise<void> {
  if (!account.refreshToken) return

  const refreshToken = decryptToken(account.refreshToken)

  const res = await fetch('https://www.strava.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: process.env.STRAVA_CLIENT_ID,
      client_secret: process.env.STRAVA_CLIENT_SECRET,
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
  })

  if (!res.ok) {
    console.error('Strava token refresh failed:', res.status)
    return
  }

  const tokens = (await res.json()) as {
    access_token: string
    refresh_token: string
    expires_at: number
  }

  await db
    .update(accounts)
    .set({
      accessToken: encryptToken(tokens.access_token),
      refreshToken: encryptToken(tokens.refresh_token),
      expiresAt: tokens.expires_at,
    })
    .where(
      eq(accounts.userId, account.userId),
    )
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
  }),
  providers: [
    StravaProvider({
      clientId: process.env.STRAVA_CLIENT_ID!,
      clientSecret: process.env.STRAVA_CLIENT_SECRET!,
    }),
  ],
  session: { strategy: 'database' },
  callbacks: {
    async jwt({ token, account }) {
      // Encrypt tokens immediately after OAuth exchange
      if (account?.access_token) {
        account.access_token = encryptToken(account.access_token)
      }
      if (account?.refresh_token) {
        account.refresh_token = encryptToken(account.refresh_token)
      }
      return token
    },
    async session({ session, user }) {
      session.user.id = user.id

      // Proactive token refresh
      const account = await db.query.accounts.findFirst({
        where: eq(accounts.userId, user.id),
      })

      if (account?.provider === 'strava' && account.expiresAt) {
        const now = Math.floor(Date.now() / 1000)
        if (account.expiresAt - now < REFRESH_THRESHOLD_S) {
          await refreshStravaToken(account)
        }
      }

      return session
    },
  },
})
```

- [ ] **Step 3.2: Verify type-check**

```bash
pnpm type-check
```

Expected: no errors.

- [ ] **Step 3.3: Commit**

```bash
git add src/auth.ts
git commit -m "feat: complete Auth.js with token encryption and proactive Strava refresh"
```

---

## Task 4: Middleware (Route Protection)

**Files:**
- Create: `src/middleware.ts`

**Interfaces:**
- Produces:
  - Unauthenticated requests to `/(user)/*` → redirect to `/`
  - Non-admin requests to `/admin/*` → redirect to `/`
  - All other routes: pass through

- [ ] **Step 4.1: Create `src/middleware.ts`**

```typescript
import { auth } from '@/auth'
import { NextResponse } from 'next/server'

export default auth((req) => {
  const { nextUrl, auth: session } = req

  const isUserRoute = nextUrl.pathname.startsWith('/dashboard') ||
    nextUrl.pathname.startsWith('/activity') ||
    nextUrl.pathname.startsWith('/editor')

  const isAdminRoute = nextUrl.pathname.startsWith('/admin')

  if (isUserRoute && !session) {
    return NextResponse.redirect(new URL('/', nextUrl))
  }

  if (isAdminRoute) {
    if (!session) {
      return NextResponse.redirect(new URL('/', nextUrl))
    }
    // Role check requires DB lookup — handled in admin layout
  }

  return NextResponse.next()
})

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/activity/:path*',
    '/editor/:path*',
    '/admin/:path*',
  ],
}
```

- [ ] **Step 4.2: Verify type-check**

```bash
pnpm type-check
```

Expected: no errors.

- [ ] **Step 4.3: Commit**

```bash
git add src/middleware.ts
git commit -m "feat: add Next.js middleware for route protection"
```

---

## Task 5: Polyline Decoder

**Files:**
- Create: `src/lib/strava/decode-polyline.ts`
- Create: `src/lib/strava/decode-polyline.test.ts`

**Interfaces:**
- Produces: `decodePolyline(encoded: string): [number, number][]` — Google Encoded Polyline → `[lat, lng][]`

- [ ] **Step 5.1: Write failing tests**

Create `src/lib/strava/decode-polyline.test.ts`:

```typescript
import { decodePolyline } from './decode-polyline'

describe('decodePolyline', () => {
  it('decodes empty string to empty array', () => {
    expect(decodePolyline('')).toEqual([])
  })

  it('decodes a known polyline (Google example: Atlanta→Chicago)', () => {
    // Known encoded polyline for [33.8,-84.4], [35.2,-80.2] (approx)
    const encoded = '_p~iF~ps|U_ulLnnqC_mqNvxq`@'
    const result = decodePolyline(encoded)
    expect(result.length).toBe(3)
    expect(result[0][0]).toBeCloseTo(38.5, 0)
    expect(result[0][1]).toBeCloseTo(-120.2, 0)
  })

  it('returns [lat, lng] pairs', () => {
    const encoded = 'u{~vHvgkbBz`@hpb@'
    const result = decodePolyline(encoded)
    expect(result.length).toBeGreaterThan(0)
    for (const [lat, lng] of result) {
      expect(typeof lat).toBe('number')
      expect(typeof lng).toBe('number')
    }
  })
})
```

- [ ] **Step 5.2: Run tests — verify they fail**

```bash
pnpm test:run src/lib/strava/decode-polyline.test.ts
```

Expected: FAIL.

- [ ] **Step 5.3: Create `src/lib/strava/decode-polyline.ts`**

```typescript
/**
 * Decodes a Google Encoded Polyline string to an array of [lat, lng] coordinates.
 * https://developers.google.com/maps/documentation/utilities/polylinealgorithm
 */
export function decodePolyline(encoded: string): [number, number][] {
  if (!encoded) return []

  const points: [number, number][] = []
  let index = 0
  let lat = 0
  let lng = 0

  while (index < encoded.length) {
    let result = 0
    let shift = 0
    let b: number

    do {
      b = encoded.charCodeAt(index++) - 63
      result |= (b & 0x1f) << shift
      shift += 5
    } while (b >= 0x20)

    lat += result & 1 ? ~(result >> 1) : result >> 1

    result = 0
    shift = 0

    do {
      b = encoded.charCodeAt(index++) - 63
      result |= (b & 0x1f) << shift
      shift += 5
    } while (b >= 0x20)

    lng += result & 1 ? ~(result >> 1) : result >> 1

    points.push([lat / 1e5, lng / 1e5])
  }

  return points
}
```

- [ ] **Step 5.4: Run tests — verify they pass**

```bash
pnpm test:run src/lib/strava/decode-polyline.test.ts
```

Expected: all 3 tests pass.

- [ ] **Step 5.5: Commit**

```bash
git add src/lib/strava/decode-polyline.ts src/lib/strava/decode-polyline.test.ts
git commit -m "feat: add Google Encoded Polyline decoder"
```

---

## Task 6: Strava API Client

**Files:**
- Create: `src/lib/strava/client.ts`

**Interfaces:**
- Produces:
  - `getStravaActivities(accessToken: string, page?: number): Promise<StravaActivity[]>` — fetches latest activities with GPS
  - `StravaActivity` type

- [ ] **Step 6.1: Create `src/lib/strava/client.ts`**

```typescript
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
```

- [ ] **Step 6.2: Commit**

```bash
git add src/lib/strava/client.ts
git commit -m "feat: add Strava API client (activities fetch)"
```

---

## Task 7: Activity Cache Service

**Depends on Plan 02:** requires `normalizeRoutePoints` from `src/lib/art/normalize-route.ts`.

**Files:**
- Create: `src/lib/strava/activity-cache.ts`

**Interfaces:**
- Produces:
  - `getOrFetchActivities(userId: string, accessToken: string): Promise<ActivityData[]>`
  - Returns cached activities if present, fetches from Strava and caches if not.

- [ ] **Step 7.1: Create `src/lib/strava/activity-cache.ts`**

```typescript
import { eq, desc } from 'drizzle-orm'
import { db } from '@/lib/db'
import { activities, accounts } from '@/lib/db/schema'
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

  // Normalize and cache
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

  // Upsert (replace existing cache)
  if (rows.length > 0) {
    await db
      .insert(activities)
      .values(rows)
      .onConflictDoUpdate({
        target: activities.id,
        set: {
          name: (sql: unknown) => sql,
          date: (sql: unknown) => sql,
          routePoints: (sql: unknown) => sql,
          hasGps: (sql: unknown) => sql,
          fetchedAt: new Date(),
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
```

Note: the `onConflictDoUpdate` set syntax may need adjustment depending on Drizzle version — use `sql` helper from drizzle-orm if needed.

- [ ] **Step 7.2: Fix the onConflictDoUpdate syntax**

Replace the `set` block in the upsert with proper Drizzle syntax:

```typescript
import { sql } from 'drizzle-orm'

// In the onConflictDoUpdate:
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
```

- [ ] **Step 7.3: Verify type-check**

```bash
pnpm type-check
```

Expected: no errors.

- [ ] **Step 7.4: Commit**

```bash
git add src/lib/strava/activity-cache.ts
git commit -m "feat: add activity cache service (lazy fetch, DB upsert, normalization)"
```

---

## Task 8: Activity Picker Component + Route

**Files:**
- Create: `src/app/(user)/layout.tsx`
- Create: `src/app/(user)/activity-picker/page.tsx`
- Create: `src/components/user/ActivityPicker.tsx`

**Interfaces:**
- Produces: `/activity-picker` page — shows GPS activities; selecting one navigates to `/editor/[activityId]` (editor route, implemented in Plan 05)

- [ ] **Step 8.1: Create `src/app/(user)/layout.tsx`**

```tsx
import { auth } from '@/auth'
import { redirect } from 'next/navigation'

export default async function UserLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()
  if (!session) redirect('/')
  return <>{children}</>
}
```

- [ ] **Step 8.2: Create `src/app/(user)/activity-picker/page.tsx`**

```tsx
import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { eq } from 'drizzle-orm'
import { accounts } from '@/lib/db/schema'
import { getOrFetchActivities } from '@/lib/strava/activity-cache'
import { ActivityPicker } from '@/components/user/ActivityPicker'

export default async function ActivityPickerPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/')

  // Get encrypted access token from DB
  const account = await db.query.accounts.findFirst({
    where: eq(accounts.userId, session.user.id),
  })

  if (!account?.accessToken) {
    return (
      <div className="flex min-h-screen items-center justify-center p-8">
        <p className="text-muted-foreground">Strava account not connected. Please sign in again.</p>
      </div>
    )
  }

  const allActivities = await getOrFetchActivities(
    session.user.id,
    account.accessToken,
  )

  // Filter to GPS-only for the picker
  const gpsActivities = allActivities.filter((a) => a.route.hasGps)

  return <ActivityPicker activities={gpsActivities} />
}
```

- [ ] **Step 8.3: Create `src/components/user/ActivityPicker.tsx`**

```tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { ActivityData } from '@/types/map-story'

interface Props {
  activities: ActivityData[]
}

const PAGE_SIZE = 10

function formatDistance(m: number): string {
  return `${(m / 1000).toFixed(1)} km`
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('it-IT', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

export function ActivityPicker({ activities }: Props) {
  const router = useRouter()
  const [page, setPage] = useState(0)

  const pageItems = activities.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)
  const totalPages = Math.ceil(activities.length / PAGE_SIZE)

  if (activities.length === 0) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center">
        <p className="text-lg font-medium">No GPS activities found</p>
        <p className="text-sm text-muted-foreground">
          Activities without GPS data (indoor runs, etc.) cannot be turned into a story.
          Go for a run outside and come back!
        </p>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-10 border-b bg-background px-4 py-3">
        <h1 className="text-lg font-semibold">Choose an activity</h1>
        <p className="text-sm text-muted-foreground">{activities.length} activities with GPS</p>
      </header>

      <ul className="flex-1 divide-y">
        {pageItems.map((activity) => (
          <li key={activity.id}>
            <button
              type="button"
              onClick={() => router.push(`/editor/${activity.id}`)}
              className="flex w-full items-center gap-4 px-4 py-4 text-left active:bg-muted"
            >
              <div className="flex-1 min-w-0">
                <p className="truncate font-medium">{activity.name}</p>
                <p className="text-sm text-muted-foreground">
                  {formatDate(activity.date)} · {formatDistance(activity.stats.distance_m)} · {activity.type}
                </p>
              </div>
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
                <path d="M7.5 5l5 5-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          </li>
        ))}
      </ul>

      {totalPages > 1 && (
        <footer className="sticky bottom-0 flex items-center justify-between border-t bg-background px-4 py-3">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            className="text-sm disabled:opacity-40"
          >
            Previous
          </button>
          <span className="text-sm text-muted-foreground">
            {page + 1} / {totalPages}
          </span>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={page === totalPages - 1}
            className="text-sm disabled:opacity-40"
          >
            Next
          </button>
        </footer>
      )}
    </div>
  )
}
```

- [ ] **Step 8.4: Verify type-check**

```bash
pnpm type-check
```

Expected: no errors.

- [ ] **Step 8.5: Commit**

```bash
git add src/app/ src/components/user/
git commit -m "feat: add activity picker (lazy fetch, GPS filter, pagination)"
```

---

## Task 9: Wiki — auth.md

**Files:**
- Create: `docs/wiki/auth.md`

- [ ] **Step 9.1: Create `docs/wiki/auth.md`**

```markdown
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
```

- [ ] **Step 9.2: Commit**

```bash
git add docs/wiki/auth.md
git commit -m "docs: add auth.md wiki page"
```

---

## Self-Review

**Spec coverage:**

| Requirement | Source | Covered |
|---|---|---|
| OAuth scope `activity:read` only | §5.1, CLAUDE.md | Task 3 (provider) |
| Summary polyline (privacy-zone safe) | §5.1 | Task 7 |
| Token encryption at rest | §5.1 | Tasks 2, 3 |
| Proactive refresh (6h expiry) | §5.1 | Task 3 |
| Lazy fetch (not at login) | §5.2 | Tasks 7, 8 |
| Cache activities in DB | §5.2 | Task 7 |
| GPS filter in picker | §9 | Task 8 |
| Empty state for no-GPS | §9 | Task 8 |
| Route protection middleware | §3 (admin) | Task 4 |
| Polyline decode | §6.1 | Task 5 |
| Normalization in data layer (not MapStory) | §6.1 | Task 7 |

**Placeholder scan:** no TBD or TODO in code. `onConflictDoUpdate` syntax note is explicit in Task 7.2.

**Type consistency:** `ActivityData` from `@/types/map-story` used throughout; `activities` Drizzle table in `@/lib/db/schema`; `encryptToken`/`decryptToken` from `@/lib/auth/token-crypto`.
