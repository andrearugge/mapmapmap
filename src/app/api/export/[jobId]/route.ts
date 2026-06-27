import { NextRequest, NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'

export const dynamic = 'force-dynamic'
import { db } from '@/lib/db'
import { renderJobs } from '@/lib/db/schema'
import { getPresignedDownloadUrl } from '@/lib/render/r2-upload'
import { auth } from '@/auth'

/**
 * GET /api/export/:jobId
 *
 * Polls the status of a render job owned by the authenticated user.
 *
 * Returns 401 if the session is missing, 404 if the job does not exist or
 * belongs to a different user, and 200 with a status payload otherwise:
 *
 * - `{ status: 'pending' | 'processing' }` — job not yet complete.
 * - `{ status: 'done', downloadUrl: string }` — job finished; `downloadUrl`
 *   is a presigned R2 URL valid for 2 hours.
 * - `{ status: 'failed', error: string }` — job failed; `error` contains the
 *   stored error message.
 *
 * @param _req    - Incoming Next.js request (unused beyond auth).
 * @param context - Route context; `params.jobId` is the UUID of the render job.
 * @returns JSON response with job status or an error.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> },
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { jobId } = await params

  const [job] = await db
    .select()
    .from(renderJobs)
    .where(eq(renderJobs.id, jobId))
    .limit(1)

  if (!job || job.userId !== session.user.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  if (job.status === 'done' && job.r2Key) {
    const downloadUrl = await getPresignedDownloadUrl(job.r2Key, 7200)
    return NextResponse.json({ status: 'done', downloadUrl })
  }

  if (job.status === 'failed') {
    return NextResponse.json({
      status: 'failed',
      error: job.errorMessage ?? 'Render failed',
    })
  }

  return NextResponse.json({ status: job.status })
}
