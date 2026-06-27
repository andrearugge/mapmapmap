import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { longTrailFixture } from '@/lib/art/fixtures'

const baseCustomizations = {
  primary: '#ffffff',
  accent: '#000000',
  background: { type: 'transparent' as const },
  artPosition: 'middle-center' as const,
}

const payload = {
  templateId: 'minimal-arc',
  activity: longTrailFixture,
  customizations: baseCustomizations,
}

describe('useExport', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('starts in idle state', async () => {
    const { useExport } = await import('@/hooks/use-export')
    const { result } = renderHook(() => useExport())
    expect(result.current.state.status).toBe('idle')
  })

  it('transitions through requesting → polling → done on success', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ jobId: 'job-1' }), { status: 202 }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ status: 'done', downloadUrl: 'https://r2.example.com/test.png' }),
          { status: 200 },
        ),
      )

    const { useExport } = await import('@/hooks/use-export')
    const { result } = renderHook(() => useExport())

    await act(async () => {
      void result.current.startExport(payload)
      await vi.runAllTimersAsync()
    })

    expect(result.current.state.status).toBe('done')
    expect(result.current.state.downloadUrl).toBe('https://r2.example.com/test.png')
  })

  it('transitions to error when POST returns non-OK status', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }),
    )

    const { useExport } = await import('@/hooks/use-export')
    const { result } = renderHook(() => useExport())

    await act(async () => {
      void result.current.startExport(payload)
      await vi.runAllTimersAsync()
    })

    expect(result.current.state.status).toBe('error')
    expect(result.current.state.error).toContain('401')
  })

  it('transitions to error when poll returns status: failed', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ jobId: 'job-1' }), { status: 202 }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ status: 'failed', error: 'Playwright crash' }),
          { status: 200 },
        ),
      )

    const { useExport } = await import('@/hooks/use-export')
    const { result } = renderHook(() => useExport())

    await act(async () => {
      void result.current.startExport(payload)
      await vi.runAllTimersAsync()
    })

    expect(result.current.state.status).toBe('error')
    expect(result.current.state.error).toBe('Playwright crash')
  })

  it('reset() returns to idle and aborts the in-flight request', async () => {
    vi.mocked(fetch).mockImplementation(() => new Promise(() => {})) // never resolves

    const { useExport } = await import('@/hooks/use-export')
    const { result } = renderHook(() => useExport())

    act(() => {
      void result.current.startExport(payload)
    })
    expect(result.current.state.status).toBe('requesting')

    act(() => {
      result.current.reset()
    })
    expect(result.current.state.status).toBe('idle')
  })
})
