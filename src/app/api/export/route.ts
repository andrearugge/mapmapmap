import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { renderJobs } from '@/lib/db/schema'
import { activityDataSchema } from '@/lib/schemas/activity'
import { customizationsSchema } from '@/lib/schemas/customizations'
import { hashRenderInput } from '@/lib/render/renderer'
import { getQueue, RENDER_QUEUE_NAME } from '@/lib/render/queue'
import type { RenderJobPayload } from '@/lib/render/queue'
import { auth } from '@/auth'

/**
 * Zod schema for the POST /api/export request body.
 * Validates templateId, activity data, and customizations.
 */
const exportRequestSchema = z.object({
  templateId: z.string().min(1),
  activity: activityDataSchema,
  customizations: customizationsSchema,
})

/**
 * POST /api/export
 *
 * Creates a new render job and enqueues it for processing.
 *
 * Validates the session (401 if unauthenticated), parses and validates the
 * request body (400 on invalid JSON or schema mismatch), inserts a
 * `render_jobs` row, enqueues a {@link RenderJobPayload} onto the pg-boss
 * `render` queue, and returns `{ jobId }` with HTTP 202.
 *
 * @param req - The incoming Next.js request. Expects a JSON body matching
 *   `{ templateId, activity, customizations }`.
 * @returns `{ jobId: string }` (202) | `{ error }` (400/401)
 */
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = exportRequestSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request', details: parsed.error.flatten() },
      { status: 400 },
    )
  }

  const { templateId, activity, customizations } = parsed.data
  const inputHash = hashRenderInput({ templateId, activity, customizations })

  const [job] = await db
    .insert(renderJobs)
    .values({ userId: session.user.id, inputHash, status: 'pending' })
    .returning({ id: renderJobs.id })

  const payload: RenderJobPayload = { jobId: job.id, templateId, activity, customizations }
  const queue = await getQueue()
  await queue.send(RENDER_QUEUE_NAME, payload)

  return NextResponse.json({ jobId: job.id }, { status: 202 })
}
