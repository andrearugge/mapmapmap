import { PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { getR2Client } from './r2-client'

/**
 * Returns the R2 bucket name from the R2_BUCKET_NAME environment variable.
 *
 * @throws {Error} If R2_BUCKET_NAME is not set.
 */
function getBucket(): string {
  const name = process.env.R2_BUCKET_NAME
  if (!name) throw new Error('R2_BUCKET_NAME not configured')
  return name
}

/**
 * Uploads a PNG buffer to Cloudflare R2 at the given object key.
 *
 * Sets ContentType to `image/png` so that clients receive the correct
 * MIME type when downloading via a presigned URL.
 *
 * @param key    - The R2 object key (e.g. `exports/<jobId>.png`).
 * @param buffer - The PNG data to upload.
 * @returns A promise that resolves when the upload is complete.
 * @throws {Error} If R2 credentials or bucket name are not configured, or if
 *   the upload request fails.
 */
export async function uploadPngToR2(key: string, buffer: Buffer): Promise<void> {
  const client = getR2Client()
  await client.send(
    new PutObjectCommand({
      Bucket: getBucket(),
      Key: key,
      Body: buffer,
      ContentType: 'image/png',
    })
  )
}

/**
 * Generates a presigned HTTPS URL for downloading an object from R2.
 *
 * The URL is valid for `ttlSeconds` seconds (default 7200, i.e. 2 hours).
 * Callers — typically the GET export route — hand this URL to the client
 * so the client can download the PNG directly from R2 without exposing
 * long-lived credentials.
 *
 * @param key        - The R2 object key (e.g. `exports/<jobId>.png`).
 * @param ttlSeconds - Lifetime of the presigned URL in seconds. Defaults to 7200 (2 h).
 * @returns A promise that resolves to the presigned download URL.
 * @throws {Error} If R2 credentials or bucket name are not configured.
 */
export async function getPresignedDownloadUrl(
  key: string,
  ttlSeconds = 7200,
): Promise<string> {
  const client = getR2Client()
  const command = new GetObjectCommand({ Bucket: getBucket(), Key: key })
  return getSignedUrl(client, command, { expiresIn: ttlSeconds })
}
