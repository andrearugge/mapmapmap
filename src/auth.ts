import NextAuth from 'next-auth'
import { DrizzleAdapter } from '@auth/drizzle-adapter'
import type { AdapterAccount } from 'next-auth/adapters'
import { eq, and } from 'drizzle-orm'
import { db } from '@/lib/db'
import { accounts, sessions, users } from '@/lib/db/schema'
import { StravaProvider } from '@/lib/auth/strava-provider'
import { encryptToken, decryptToken } from '@/lib/auth/token-crypto'

// Kept for future proactive token refresh — see ADR-002
async function refreshStravaToken(
  account: typeof accounts.$inferSelect,
): Promise<void> {
  if (!account.refresh_token) return

  const refreshToken = decryptToken(account.refresh_token)

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

  if (!tokens.access_token || !tokens.refresh_token) {
    console.error('Strava token refresh returned unexpected response shape')
    return
  }

  await db
    .update(accounts)
    .set({
      access_token: encryptToken(tokens.access_token),
      refresh_token: encryptToken(tokens.refresh_token),
      expires_at: tokens.expires_at,
    })
    .where(and(eq(accounts.userId, account.userId), eq(accounts.provider, 'strava')))
}

// Build a DrizzleAdapter and wrap linkAccount to encrypt Strava tokens before
// they are written to the database.
const baseAdapter = DrizzleAdapter(db, {
  usersTable: users,
  accountsTable: accounts,
  sessionsTable: sessions,
})

const encryptingAdapter = {
  ...baseAdapter,
  async linkAccount(
    account: AdapterAccount,
  ): Promise<AdapterAccount | null | undefined> {
    // Build a mutable copy to avoid mutating readonly fields on the original
    const encrypted = Object.assign({}, account) as AdapterAccount & {
      access_token?: string
      refresh_token?: string
    }
    if (typeof encrypted.access_token === 'string') {
      ;(encrypted as any).access_token = encryptToken(encrypted.access_token)
    }
    if (typeof encrypted.refresh_token === 'string') {
      ;(encrypted as any).refresh_token = encryptToken(encrypted.refresh_token)
    }
    const result = await baseAdapter.linkAccount!(encrypted)
    // baseAdapter.linkAccount may return void — normalise to undefined
    return result ?? undefined
  },
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: encryptingAdapter,
  providers: [
    StravaProvider({
      clientId: process.env.STRAVA_CLIENT_ID!,
      clientSecret: process.env.STRAVA_CLIENT_SECRET!,
    }),
  ],
  // JWT strategy: sessions stored in signed cookies, not the DB.
  // This lets the Edge middleware decode sessions without a DB query.
  session: { strategy: 'jwt' },
  callbacks: {
    async session({ session, token }) {
      if (token.sub) session.user.id = token.sub
      return session
    },
  },
})
