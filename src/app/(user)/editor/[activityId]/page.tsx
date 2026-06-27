import { redirect } from 'next/navigation'
import Link from 'next/link'
import { auth } from '@/auth'
import { getCachedActivity } from '@/lib/strava/get-cached-activity'
import { artRegistry } from '@/lib/art/registry'

interface Props {
  params: Promise<{ activityId: string }>
}

export default async function TemplatePicker({ params }: Props) {
  const session = await auth()
  if (!session?.user?.id) redirect('/')

  const { activityId } = await params
  const activity = await getCachedActivity(session.user.id, activityId)
  if (!activity) redirect('/activity-picker')

  const templates = Array.from(artRegistry.values())

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-10 border-b bg-background px-4 py-3">
        <h1 className="text-lg font-semibold">Choose a style</h1>
        <p className="truncate text-sm text-muted-foreground">{activity.name}</p>
      </header>

      <ul className="flex-1 divide-y">
        {templates.map((template) => (
          <li key={template.id}>
            <Link
              href={`/editor/${activityId}/${template.id}`}
              className="flex w-full items-center gap-4 px-4 py-5 text-left active:bg-muted"
            >
              <div className="min-w-0 flex-1">
                <p className="font-medium">{template.name}</p>
              </div>
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
                <path
                  d="M7.5 5l5 5-5 5"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
