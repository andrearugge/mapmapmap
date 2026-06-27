import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockSend = vi.fn().mockResolvedValue({})

vi.mock('@aws-sdk/client-s3', () => ({
  S3Client: vi.fn(function () {
    return { send: mockSend }
  }),
  PutObjectCommand: vi.fn(function (input) {
    return { input }
  }),
  GetObjectCommand: vi.fn(function (input) {
    return { input }
  }),
}))

vi.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: vi.fn().mockResolvedValue('https://r2.example.com/exports/test.png?X-Amz-Signature=abc'),
}))

describe('r2-upload', () => {
  beforeEach(() => {
    vi.resetModules()
    process.env.R2_ACCOUNT_ID = 'test-account'
    process.env.R2_ACCESS_KEY_ID = 'test-key-id'
    process.env.R2_SECRET_ACCESS_KEY = 'test-secret'
    process.env.R2_BUCKET_NAME = 'test-bucket'
  })

  it('uploadPngToR2 sends PutObjectCommand with correct content-type', async () => {
    const { uploadPngToR2 } = await import('@/lib/render/r2-upload')
    const { PutObjectCommand } = await import('@aws-sdk/client-s3')
    const buffer = Buffer.from('fake-png-data')
    await uploadPngToR2('exports/test-job.png', buffer)
    expect(PutObjectCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        Key: 'exports/test-job.png',
        ContentType: 'image/png',
      })
    )
  })

  it('getPresignedDownloadUrl returns a URL string', async () => {
    const { getPresignedDownloadUrl } = await import('@/lib/render/r2-upload')
    const url = await getPresignedDownloadUrl('exports/test-job.png', 7200)
    expect(url).toMatch(/^https?:\/\//)
  })

  it('getPresignedDownloadUrl defaults to 7200s TTL', async () => {
    const { getPresignedDownloadUrl } = await import('@/lib/render/r2-upload')
    const { getSignedUrl } = await import('@aws-sdk/s3-request-presigner')
    await getPresignedDownloadUrl('exports/test-job.png')
    expect(getSignedUrl).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      { expiresIn: 7200 }
    )
  })
})
