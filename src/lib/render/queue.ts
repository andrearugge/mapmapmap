import { PgBoss } from 'pg-boss'
import type { ActivityData, Customizations } from '@/types/map-story'

/** The name of the pg-boss queue used for render jobs. */
export const RENDER_QUEUE_NAME = 'render' as const

/**
 * Payload enqueued for each render job.
 *
 * @property jobId          - UUID of the `render_jobs` row to update.
 * @property templateId     - ID of the Art template to render.
 * @property activity       - Normalised activity data for the render.
 * @property customizations - User-chosen customisation options.
 */
export interface RenderJobPayload {
  jobId: string
  templateId: string
  activity: ActivityData
  customizations: Customizations
}

let _boss: PgBoss | null = null

/**
 * Returns the singleton `PgBoss` instance, starting it on first call.
 *
 * Reads `DATABASE_URL` from the environment. Subsequent calls return the
 * already-started instance without re-initialising the connection.
 *
 * @returns The running `PgBoss` instance.
 * @throws {Error} If `DATABASE_URL` is not set in the environment.
 */
export async function getQueue(): Promise<PgBoss> {
  if (_boss) return _boss

  const dbUrl = process.env.DATABASE_URL
  if (!dbUrl) throw new Error('DATABASE_URL not configured')

  _boss = new PgBoss(dbUrl)
  await _boss.start()
  return _boss
}
