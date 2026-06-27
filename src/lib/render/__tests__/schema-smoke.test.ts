import { describe, it, expect } from 'vitest'

describe('renderJobs schema smoke', () => {
  it('exports renderJobs and its columns compile', async () => {
    const { renderJobs } = await import('@/lib/db/schema')
    expect(renderJobs).toBeDefined()
    expect(renderJobs.id).toBeDefined()
    expect(renderJobs.userId).toBeDefined()
    expect(renderJobs.inputHash).toBeDefined()
    expect(renderJobs.status).toBeDefined()
    expect(renderJobs.r2Key).toBeDefined()
    expect(renderJobs.errorMessage).toBeDefined()
    expect(renderJobs.createdAt).toBeDefined()
    expect(renderJobs.updatedAt).toBeDefined()
  })
})
