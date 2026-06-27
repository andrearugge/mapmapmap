'use client'

import { useCallback, useRef, useState } from 'react'
import type { ActivityData, Customizations } from '@/types/map-story'

export type ExportStatus = 'idle' | 'requesting' | 'polling' | 'done' | 'error'

export interface ExportState {
  status: ExportStatus
  downloadUrl?: string
  error?: string
}

export interface ExportPayload {
  templateId: string
  activity: ActivityData
  customizations: Customizations
}

const POLL_INTERVAL_MS = 1500
const MAX_POLLS = 40

export function useExport() {
  const [state, setState] = useState<ExportState>({ status: 'idle' })
  const abortRef = useRef<AbortController | null>(null)

  const startExport = useCallback(async (payload: ExportPayload) => {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setState({ status: 'requesting' })

    try {
      const postRes = await fetch('/api/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal,
      })

      if (!postRes.ok) {
        const err = await postRes.json().catch(() => ({})) as { error?: string }
        const msg = err.error ? `${err.error} (${postRes.status})` : `Export failed (${postRes.status})`
        throw new Error(msg)
      }

      const { jobId } = (await postRes.json()) as { jobId: string }
      setState({ status: 'polling' })

      for (let i = 0; i < MAX_POLLS; i++) {
        await new Promise<void>((resolve) => setTimeout(resolve, POLL_INTERVAL_MS))
        if (controller.signal.aborted) return

        const pollRes = await fetch(`/api/export/${jobId}`, {
          signal: controller.signal,
        })
        const data = (await pollRes.json()) as {
          status: string
          downloadUrl?: string
          error?: string
        }

        if (data.status === 'done') {
          setState({ status: 'done', downloadUrl: data.downloadUrl })
          return
        }
        if (data.status === 'failed') {
          setState({ status: 'error', error: data.error ?? 'Render failed' })
          return
        }
      }

      setState({ status: 'error', error: 'Export timed out' })
    } catch (err) {
      if ((err as { name?: string }).name === 'AbortError') return
      setState({
        status: 'error',
        error: err instanceof Error ? err.message : 'Export failed',
      })
    }
  }, [])

  const reset = useCallback(() => {
    abortRef.current?.abort()
    setState({ status: 'idle' })
  }, [])

  return { state, startExport, reset }
}
