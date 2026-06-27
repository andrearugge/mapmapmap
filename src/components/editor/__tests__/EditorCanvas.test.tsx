import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render } from '@testing-library/react'
import { EditorCanvas } from '@/components/editor/EditorCanvas'
import { minimalArcTemplate } from '@/lib/art/arts/minimal-arc'
import { longTrailFixture } from '@/lib/art/fixtures'

// ResizeObserver does not exist in jsdom — stub it before the component renders.
beforeEach(() => {
  vi.stubGlobal('ResizeObserver', class {
    observe() {}
    disconnect() {}
  })
})

const baseCustomizations = {
  primary: '#ffffff',
  accent: '#000000',
  background: { type: 'transparent' as const },
  artPosition: 'middle-center' as const,
}

describe('EditorCanvas', () => {
  it('renders MapStory (data-mapstory attribute present)', () => {
    render(
      <EditorCanvas
        template={minimalArcTemplate}
        activity={longTrailFixture}
        customizations={baseCustomizations}
      />,
    )
    expect(document.querySelector('[data-mapstory]')).not.toBeNull()
  })

  it('outer container has aspect-ratio style set', () => {
    const { container } = render(
      <EditorCanvas
        template={minimalArcTemplate}
        activity={longTrailFixture}
        customizations={baseCustomizations}
      />,
    )
    const outer = container.firstChild as HTMLElement
    expect(outer.style.aspectRatio).toBeTruthy()
  })
})
