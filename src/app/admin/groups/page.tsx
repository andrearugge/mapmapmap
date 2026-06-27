import { db } from '@/lib/db'
import { groups, userGroups } from '@/lib/db/schema'
import { count, eq, desc } from 'drizzle-orm'
import { GroupsTable } from '@/components/admin/GroupsTable'
import type { GroupRow } from '@/components/admin/GroupsTable'

export default async function AdminGroupsPage() {
  const rows = await db
    .select({
      id: groups.id,
      name: groups.name,
      createdAt: groups.createdAt,
      memberCount: count(userGroups.userId),
    })
    .from(groups)
    .leftJoin(userGroups, eq(groups.id, userGroups.groupId))
    .groupBy(groups.id, groups.name, groups.createdAt)
    .orderBy(desc(groups.createdAt))

  const groupRows: GroupRow[] = rows.map((r) => ({
    id: r.id,
    name: r.name,
    createdAt: r.createdAt,
    memberCount: r.memberCount,
  }))

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Groups</h1>
        <p className="text-sm text-muted-foreground">{rows.length} groups</p>
      </div>
      <GroupsTable groups={groupRows} />
    </div>
  )
}
