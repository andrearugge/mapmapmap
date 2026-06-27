import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import type { Session } from 'next-auth'

// Mock auth
vi.mock('@/auth', () => ({
  auth: vi.fn(),
}))

// Mock db
vi.mock('@/lib/db', () => ({
  db: {
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{ id: 'test-job-uuid' }]),
      }),
    }),
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([]),
        }),
      }),
    }),
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      }),
    }),
  },
}))

// Mock queue
vi.mock('@/lib/render/queue', () => ({
  getQueue: vi.fn().mockResolvedValue({
    send: vi.fn().mockResolvedValue('pg-boss-id'),
  }),
  RENDER_QUEUE_NAME: 'render',
}))

// Mock R2
vi.mock('@/lib/render/r2-upload', () => ({
  getPresignedDownloadUrl: vi.fn().mockResolvedValue('https://r2.example.com/exports/test-job-uuid.png?X-Amz-Signature=abc'),
}))

import { auth } from '@/auth'

// `auth` has a complex overloaded signature (session getter + middleware). Cast to a
// simple mock that returns `Promise<Session | null>` so `mockResolvedValue` type-checks.
const mockAuth = vi.mocked(auth) as unknown as {
  mockResolvedValue: (val: Session | null) => void
}

const validBody = {
  templateId: 'minimal-arc',
  activity: {
    id: 'act-1',
    type: 'run',
    name: 'Morning run',
    date: '2024-01-15T08:00:00Z',
    stats: {
      distance_m: 10000,
      movingTime_s: 3600,
      elapsedTime_s: 3700,
      elevationGain_m: 150,
      avgSpeed_mps: 2.78,
    },
    route: { points: [[0.5, 0.5]] as [number, number][], hasGps: true },
    athlete: { name: 'Test User' },
  },
  customizations: {
    primary: '#ffffff',
    accent: '#ff5500',
    background: { type: 'transparent' },
    artPosition: 'middle-center',
  },
}

describe('POST /api/export', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 when not authenticated', async () => {
    mockAuth.mockResolvedValue(null)
    const { POST } = await import('@/app/api/export/route')
    const req = new NextRequest('http://localhost/api/export', {
      method: 'POST',
      body: JSON.stringify(validBody),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    expect(res.status).toBe(401)
  })

  it('returns 400 for invalid body', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'user-1', name: '', email: '', image: '' }, expires: '2099-01-01' })
    const { POST } = await import('@/app/api/export/route')
    const req = new NextRequest('http://localhost/api/export', {
      method: 'POST',
      body: JSON.stringify({ templateId: 'minimal-arc' }), // missing activity and customizations
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('returns 202 with jobId for valid request', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'user-1', name: '', email: '', image: '' }, expires: '2099-01-01' })
    const { POST } = await import('@/app/api/export/route')
    const req = new NextRequest('http://localhost/api/export', {
      method: 'POST',
      body: JSON.stringify(validBody),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    expect(res.status).toBe(202)
    const body = await res.json()
    expect(body).toHaveProperty('jobId', 'test-job-uuid')
  })
})

describe('GET /api/export/[jobId]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 when not authenticated', async () => {
    mockAuth.mockResolvedValue(null)
    const { GET } = await import('@/app/api/export/[jobId]/route')
    const req = new NextRequest('http://localhost/api/export/test-job-uuid')
    const res = await GET(req, { params: Promise.resolve({ jobId: 'test-job-uuid' }) })
    expect(res.status).toBe(401)
  })

  it('returns 404 when job not found', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'user-1', name: '', email: '', image: '' }, expires: '2099-01-01' })
    const { db } = await import('@/lib/db')
    vi.mocked(db.select).mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([]),
        }),
      }),
    } as unknown as ReturnType<typeof db.select>)

    const { GET } = await import('@/app/api/export/[jobId]/route')
    const req = new NextRequest('http://localhost/api/export/missing-id')
    const res = await GET(req, { params: Promise.resolve({ jobId: 'missing-id' }) })
    expect(res.status).toBe(404)
  })

  it('returns { status: "pending" } for pending job', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'user-1', name: '', email: '', image: '' }, expires: '2099-01-01' })
    const { db } = await import('@/lib/db')
    vi.mocked(db.select).mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([{
            id: 'test-job-uuid', userId: 'user-1', status: 'pending',
            r2Key: null, errorMessage: null,
          }]),
        }),
      }),
    } as unknown as ReturnType<typeof db.select>)

    const { GET } = await import('@/app/api/export/[jobId]/route')
    const req = new NextRequest('http://localhost/api/export/test-job-uuid')
    const res = await GET(req, { params: Promise.resolve({ jobId: 'test-job-uuid' }) })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual({ status: 'pending' })
  })

  it('returns { status: "done", downloadUrl } for completed job', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'user-1', name: '', email: '', image: '' }, expires: '2099-01-01' })
    const { db } = await import('@/lib/db')
    vi.mocked(db.select).mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([{
            id: 'test-job-uuid', userId: 'user-1', status: 'done',
            r2Key: 'exports/test-job-uuid.png', errorMessage: null,
          }]),
        }),
      }),
    } as unknown as ReturnType<typeof db.select>)

    const { GET } = await import('@/app/api/export/[jobId]/route')
    const req = new NextRequest('http://localhost/api/export/test-job-uuid')
    const res = await GET(req, { params: Promise.resolve({ jobId: 'test-job-uuid' }) })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.status).toBe('done')
    expect(body.downloadUrl).toMatch(/^https?:\/\//)
  })
})
