'use server'

import { revalidatePath } from 'next/cache'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { requireAdmin } from '@/lib/auth/require-admin'

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
