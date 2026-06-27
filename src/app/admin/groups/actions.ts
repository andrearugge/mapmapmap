'use server'

import { revalidatePath } from 'next/cache'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { groups } from '@/lib/db/schema'
import { requireAdmin } from '@/lib/auth/require-admin'

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
