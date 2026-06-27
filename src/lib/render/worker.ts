import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { renderJobs } from '@/lib/db/schema'
import { getTemplate } from '@/lib/art/registry'
import { PlaywrightRenderer } from './playwright-renderer'
import { uploadPngToR2 } from './r2-upload'
import type { Job } from 'pg-boss'
import { getQueue, RENDER_QUEUE_NAME } from './queue'
import type { RenderJobPayload } from './queue'

/**
 * Subscribes to the `render` pg-boss queue and processes render jobs.
 *
 * For each job the worker:
 * 1. Marks the `render_jobs` row as `processing`.
 * 2. Looks up the Art template and calls `PlaywrightRenderer.render()`.
 * 3. Uploads the resulting PNG to R2.
 * 4. Marks the row as `done` (with the R2 key) or `failed` (with the error message).
 *
 * Concurrency is controlled by the `RENDER_QUEUE_CONCURRENCY` environment
 * variable (defaults to `2`).
 *
 * @returns A promise that resolves once the worker is registered with pg-boss.
 */
export async function startWorker(): Promise<void> {
  const concurrency = Number(process.env.RENDER_QUEUE_CONCURRENCY ?? 2)
  const queue = await getQueue()
  const renderer = new PlaywrightRenderer()

  // pg-boss v12: the handler receives an array of Job<T>.
  // With localConcurrency > 1 multiple array entries may arrive in one batch.
  await queue.work<RenderJobPayload>(
    RENDER_QUEUE_NAME,
    { localConcurrency: concurrency },
    async (jobs: Job<RenderJobPayload>[]) => {
      for (const job of jobs) {
        const { jobId, templateId, activity, customizations } = job.data

        await db
          .update(renderJobs)
          .set({ status: 'processing', updatedAt: new Date() })
          .where(eq(renderJobs.id, jobId))

        try {
          const template = getTemplate(templateId)

          const { png } = await renderer.render({ template, activity, customizations })

          const r2Key = `exports/${jobId}.png`
          await uploadPngToR2(r2Key, png)

          await db
            .update(renderJobs)
            .set({ status: 'done', r2Key, updatedAt: new Date() })
            .where(eq(renderJobs.id, jobId))
        } catch (err) {
          await db
            .update(renderJobs)
            .set({
              status: 'failed',
              errorMessage: err instanceof Error ? err.message : String(err),
              updatedAt: new Date(),
            })
            .where(eq(renderJobs.id, jobId))

          // Re-throw so pg-boss records the failure and applies its retry policy.
          throw err
        }
      }
    },
  )

  console.log(`Render worker started (concurrency: ${concurrency})`)
}
