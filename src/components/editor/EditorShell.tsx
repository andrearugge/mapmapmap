'use client'

import { useState } from 'react'
import type { ActivityData, Customizations, Template } from '@/types/map-story'
import { defaultCustomizations } from '@/lib/art/default-customizations'
import { useExport } from '@/hooks/use-export'
import { EditorCanvas } from './EditorCanvas'
import { EditorControls } from './EditorControls'

interface EditorShellProps {
  template: Template
  activity: ActivityData
}

/**
 * Client Component that owns all editor state.
 *
 * Manages `Customizations` state and delegates rendering to `EditorCanvas`
 * and `EditorControls`. Exposes a status strip during export and a "Share"
 * button in the header once the export is done.
 *
 * Share handler: fetches PNG blob from `downloadUrl`, calls
 * `navigator.share({ files })` if supported, otherwise triggers a
 * `<a download>` fallback.
 */
export function EditorShell({ template, activity }: EditorShellProps) {
  const [customizations, setCustomizations] = useState<Customizations>(() =>
    defaultCustomizations(template),
  )
  const { state: exportState, startExport, reset } = useExport()

  const isExporting =
    exportState.status === 'requesting' || exportState.status === 'polling'

  async function handleExport() {
    await startExport({ templateId: template.id, activity, customizations })
  }

  async function handleShare() {
    if (!exportState.downloadUrl) return
    const res = await fetch(exportState.downloadUrl)
    const blob = await res.blob()
    const file = new File([blob], 'mapmapmap.png', { type: 'image/png' })

    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title: activity.name })
    } else {
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = 'mapmapmap.png'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(a.href)
    }
  }

  return (
    <div className="flex h-dvh flex-col bg-neutral-900">
      {/* Header */}
      <header className="flex items-center gap-2 border-b border-white/10 px-4 py-3">
        <p className="min-w-0 flex-1 truncate text-sm font-medium text-white">
          {activity.name}
        </p>
        {exportState.status === 'done' && (
          <button
            type="button"
            onClick={handleShare}
            className="shrink-0 rounded-full bg-white px-4 py-1.5 text-sm font-semibold text-black"
          >
            Share
          </button>
        )}
      </header>

      {/* Canvas area */}
      <div className="flex flex-1 items-center justify-center overflow-hidden p-2">
        <EditorCanvas
          template={template}
          activity={activity}
          customizations={customizations}
        />
      </div>

      {/* Export status strip — shown between canvas and controls */}
      {exportState.status !== 'idle' && exportState.status !== 'done' && (
        <div
          className={[
            'px-4 py-2 text-center text-sm',
            exportState.status === 'error'
              ? 'bg-red-950/60 text-red-400'
              : 'bg-white/5 text-white/60',
          ].join(' ')}
        >
          {exportState.status === 'requesting' && 'Starting export…'}
          {exportState.status === 'polling' && 'Rendering…'}
          {exportState.status === 'error' && (
            <>
              {exportState.error}{' '}
              <button type="button" onClick={reset} className="underline">
                Try again
              </button>
            </>
          )}
        </div>
      )}

      {/* Controls */}
      <EditorControls
        template={template}
        customizations={customizations}
        onChange={setCustomizations}
        onExport={handleExport}
        exportDisabled={isExporting || exportState.status === 'done'}
      />
    </div>
  )
}
