import { db } from '@/lib/db'
import { users, renderJobs } from '@/lib/db/schema'
import { count, countDistinct, gte, and, eq } from 'drizzle-orm'

export default async function AdminAnalyticsPage() {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

  const [
    [{ totalUsers }],
    [{ newUsers30d }],
    [{ totalExports }],
    [{ exports7d }],
    [{ activeUsers }],
  ] = await Promise.all([
    db.select({ totalUsers: count() }).from(users),
    db
      .select({ newUsers30d: count() })
      .from(users)
      .where(gte(users.createdAt, thirtyDaysAgo)),
    db
      .select({ totalExports: count() })
      .from(renderJobs)
      .where(eq(renderJobs.status, 'done')),
    db
      .select({ exports7d: count() })
      .from(renderJobs)
      .where(and(eq(renderJobs.status, 'done'), gte(renderJobs.createdAt, sevenDaysAgo))),
    db
      .select({ activeUsers: countDistinct(renderJobs.userId) })
      .from(renderJobs)
      .where(eq(renderJobs.status, 'done')),
  ])

  const metrics = [
    { label: 'Total users', value: totalUsers },
    { label: 'New users (30 d)', value: newUsers30d },
    { label: 'Active users (≥1 export)', value: activeUsers },
    { label: 'Total exports', value: totalExports },
    { label: 'Exports (7 d)', value: exports7d },
  ]

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Analytics</h1>
      <p className="text-sm text-muted-foreground">
        App metadata only — no Strava activity data.
      </p>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        {metrics.map(({ label, value }) => (
          <div key={label} className="rounded-lg border p-4">
            <p className="text-2xl font-bold tabular-nums">{value}</p>
            <p className="mt-1 text-xs text-muted-foreground">{label}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
