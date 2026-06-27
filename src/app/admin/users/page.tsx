import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { desc } from 'drizzle-orm'
import { UsersTable } from '@/components/admin/UsersTable'
import type { UserRow } from '@/components/admin/UsersTable'
import { requireAdmin } from '@/lib/auth/require-admin'

export default async function AdminUsersPage() {
  await requireAdmin()

  const rows = await db
    .select({
      id: users.id,
      name: users.name,
      handle: users.handle,
      role: users.role,
      createdAt: users.createdAt,
    })
    .from(users)
    .orderBy(desc(users.createdAt))

  const userRows: UserRow[] = rows.map((r) => ({
    id: r.id,
    name: r.name,
    handle: r.handle,
    role: r.role,
    createdAt: r.createdAt,
  }))

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Users</h1>
        <p className="text-sm text-muted-foreground">{rows.length} registered</p>
      </div>
      <UsersTable users={userRows} />
    </div>
  )
}
