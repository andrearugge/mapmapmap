import { S3Client } from '@aws-sdk/client-s3'

let _r2Client: S3Client | null = null

/**
 * Returns a singleton S3Client configured for Cloudflare R2.
 *
 * Reads R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, and R2_SECRET_ACCESS_KEY from the
 * process environment. Throws if any of these are missing so that
 * misconfiguration is surfaced at call-time rather than silently at upload-time.
 *
 * @returns A configured S3Client instance (reused across calls in the same process).
 * @throws {Error} If any required R2 credential env vars are missing.
 */
export function getR2Client(): S3Client {
  if (_r2Client) return _r2Client

  const accountId = process.env.R2_ACCOUNT_ID
  const accessKeyId = process.env.R2_ACCESS_KEY_ID
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY

  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error('R2 credentials not configured (R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY)')
  }

  _r2Client = new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  })
  return _r2Client
}
