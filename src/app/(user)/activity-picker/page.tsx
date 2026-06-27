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

  if (!account?.access_token) {
    return (
      <div className="flex min-h-screen items-center justify-center p-8">
        <p className="text-muted-foreground">Strava account not connected. Please sign in again.</p>
      </div>
    )
  }

  const allActivities = await getOrFetchActivities(
    session.user.id,
    account.access_token,
  )

  // Filter to GPS-only for the picker
  const gpsActivities = allActivities.filter((a) => a.route.hasGps)

  return <ActivityPicker activities={gpsActivities} />
}
