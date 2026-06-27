import { describe, it, expect } from 'vitest'

describe('queue exports', () => {
  it('RENDER_QUEUE_NAME is the string "render"', async () => {
    const { RENDER_QUEUE_NAME } = await import('@/lib/render/queue')
    expect(RENDER_QUEUE_NAME).toBe('render')
  })
})
