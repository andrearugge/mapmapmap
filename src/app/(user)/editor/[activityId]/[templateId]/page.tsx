import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { getCachedActivity } from '@/lib/strava/get-cached-activity'
import { artRegistry } from '@/lib/art/registry'
import { EditorShell } from '@/components/editor/EditorShell'

interface Props {
  params: Promise<{ activityId: string; templateId: string }>
}

export default async function EditorPage({ params }: Props) {
  const session = await auth()
  if (!session?.user?.id) redirect('/')

  const { activityId, templateId } = await params

  const activity = await getCachedActivity(session.user.id, activityId)
  if (!activity) redirect('/activity-picker')

  const template = artRegistry.get(templateId)
  if (!template) redirect(`/editor/${activityId}`)

  return <EditorShell templateId={templateId} activity={activity} />
}
