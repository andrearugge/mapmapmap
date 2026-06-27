'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { auth } from '@/auth'

async function requireAdmin(): Promise<string> {
  const session = await auth()
  if (!session?.user?.id) redirect('/')

  const [caller] = await db
    .select({ role: users.role })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1)

  if (caller?.role !== 'admin') throw new Error('Unauthorized')
  return session.user.id
}

export async function updateUserRole(userId: string, role: 'user' | 'admin'): Promise<void> {
  const callerId = await requireAdmin()
  if (userId === callerId && role === 'user') throw new Error('Cannot remove own admin role')

  await db.update(users).set({ role, updatedAt: new Date() }).where(eq(users.id, userId))
  revalidatePath('/admin/users')
}

export async function deleteUser(userId: string): Promise<void> {
  const callerId = await requireAdmin()
  if (userId === callerId) throw new Error('Cannot delete own account')

  await db.delete(users).where(eq(users.id, userId))
  revalidatePath('/admin/users')
}
