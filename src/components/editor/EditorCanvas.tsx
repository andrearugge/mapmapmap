'use client'

import { useEffect, useRef, useState } from 'react'
import { MapStory } from '@/components/art/MapStory'
import type { ActivityData, Customizations, Template } from '@/types/map-story'

const CANVAS_W = 1080
const CANVAS_H = 1920

export interface EditorCanvasProps {
  template: Template
  activity: ActivityData
  customizations: Customizations
}

/**
 * Renders MapStory at its native 1080×1920 resolution and scales it down
 * to fit any container width via ResizeObserver.
 *
 * The outer container is `width: 100%` with `aspect-ratio: 1080/1920` so height
 * follows automatically. The inner div is absolutely positioned at the native
 * canvas size, then `transform: scale(containerWidth / 1080)` is applied with
 * `transform-origin: top left` to ensure pixel-perfect rendering — MapStory
 * always sees exactly 1080 CSS pixels.
 */
export function EditorCanvas({ template, activity, customizations }: EditorCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(0.25) // conservative initial; updated on mount

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const observer = new ResizeObserver(([entry]) => {
      setScale(entry.contentRect.width / CANVAS_W)
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        aspectRatio: `${CANVAS_W} / ${CANVAS_H}`,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          width: CANVAS_W,
          height: CANVAS_H,
          transformOrigin: 'top left',
          transform: `scale(${scale})`,
          position: 'absolute',
          top: 0,
          left: 0,
        }}
      >
        <MapStory template={template} activity={activity} customizations={customizations} />
      </div>
    </div>
  )
}
