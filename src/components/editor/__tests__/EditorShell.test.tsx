import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { EditorShell } from '@/components/editor/EditorShell'
import { longTrailFixture } from '@/lib/art/fixtures'

vi.stubGlobal('ResizeObserver', class {
  observe() {}
  unobserve() {}
  disconnect() {}
})

vi.mock('@/hooks/use-export', () => ({
  useExport: () => ({
    state: { status: 'idle' },
    startExport: vi.fn(),
    reset: vi.fn(),
  }),
}))

describe('EditorShell', () => {
  it('renders the activity name in the header', () => {
    render(<EditorShell templateId="minimal-arc" activity={longTrailFixture} />)
    expect(screen.getByText(longTrailFixture.name)).toBeInTheDocument()
  })

  it('renders the Export PNG button', () => {
    render(<EditorShell templateId="minimal-arc" activity={longTrailFixture} />)
    expect(screen.getByRole('button', { name: /export png/i })).toBeInTheDocument()
  })

  it('renders the MapStory canvas', () => {
    render(<EditorShell templateId="minimal-arc" activity={longTrailFixture} />)
    expect(document.querySelector('[data-mapstory]')).not.toBeNull()
  })
})
