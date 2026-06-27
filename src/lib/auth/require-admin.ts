import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

/**
 * Asserts that the current request is made by an authenticated admin user.
 *
 * Redirects to `/` if there is no session. Throws `Error('Unauthorized')` if
 * the authenticated user does not have the `admin` role.
 *
 * @returns The authenticated user's ID.
 */
export async function requireAdmin(): Promise<string> {
  const session = await auth()
  if (!session?.user?.id) redirect('/')

  const [dbUser] = await db
    .select({ role: users.role })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1)

  if (dbUser?.role !== 'admin') throw new Error('Unauthorized')
  return session.user.id
}
