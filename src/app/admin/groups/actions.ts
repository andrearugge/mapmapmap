'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { users, groups } from '@/lib/db/schema'
import { auth } from '@/auth'

async function requireAdmin(): Promise<void> {
  const session = await auth()
  if (!session?.user?.id) redirect('/')

  const [caller] = await db
    .select({ role: users.role })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1)

  if (caller?.role !== 'admin') throw new Error('Unauthorized')
}

export async function createGroup(name: string): Promise<void> {
  await requireAdmin()
  if (!name.trim()) throw new Error('Group name is required')

  await db.insert(groups).values({ name: name.trim() })
  revalidatePath('/admin/groups')
}

export async function deleteGroup(groupId: string): Promise<void> {
  await requireAdmin()
  await db.delete(groups).where(eq(groups.id, groupId))
  revalidatePath('/admin/groups')
}
