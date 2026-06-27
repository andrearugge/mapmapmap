import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { EditorControls } from '@/components/editor/EditorControls'
import { minimalArcTemplate } from '@/lib/art/arts/minimal-arc'

const baseCustomizations = {
  primary: '#ffffff',
  accent: '#000000',
  background: { type: 'transparent' as const },
  artPosition: 'middle-center' as const,
}

describe('EditorControls', () => {
  it('renders primary and accent hex text inputs', () => {
    render(
      <EditorControls
        template={minimalArcTemplate}
        customizations={baseCustomizations}
        onChange={vi.fn()}
        onExport={vi.fn()}
        exportDisabled={false}
      />,
    )
    expect(screen.getByTestId('color-input-primary')).toBeInTheDocument()
    expect(screen.getByTestId('color-input-accent')).toBeInTheDocument()
  })

  it('renders one position button per allowedAnchor', () => {
    render(
      <EditorControls
        template={minimalArcTemplate}
        customizations={baseCustomizations}
        onChange={vi.fn()}
        onExport={vi.fn()}
        exportDisabled={false}
      />,
    )
    const positionSection = screen.getByTestId('position-controls')
    // MinimalArc allowedAnchors: ['top-center', 'middle-center', 'bottom-center'] (3 buttons)
    expect(positionSection.querySelectorAll('button')).toHaveLength(
      minimalArcTemplate.allowedAnchors.length,
    )
  })

  it('calls onChange with updated primary when valid hex entered in text input', () => {
    const onChange = vi.fn()
    render(
      <EditorControls
        template={minimalArcTemplate}
        customizations={baseCustomizations}
        onChange={onChange}
        onExport={vi.fn()}
        exportDisabled={false}
      />,
    )
    fireEvent.change(screen.getByTestId('color-input-primary'), {
      target: { value: '#ff0000' },
    })
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ primary: '#ff0000' }),
    )
  })

  it('does NOT call onChange when partial hex entered (invalid mid-type)', () => {
    const onChange = vi.fn()
    render(
      <EditorControls
        template={minimalArcTemplate}
        customizations={baseCustomizations}
        onChange={onChange}
        onExport={vi.fn()}
        exportDisabled={false}
      />,
    )
    fireEvent.change(screen.getByTestId('color-input-primary'), {
      target: { value: '#ff' },
    })
    expect(onChange).not.toHaveBeenCalled()
  })

  it('calls onChange with updated artPosition when position button clicked', () => {
    const onChange = vi.fn()
    render(
      <EditorControls
        template={minimalArcTemplate}
        customizations={baseCustomizations}
        onChange={onChange}
        onExport={vi.fn()}
        exportDisabled={false}
      />,
    )
    fireEvent.click(screen.getByTestId('anchor-button-top-center'))
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ artPosition: 'top-center' }),
    )
  })

  it('calls onExport when export button clicked', () => {
    const onExport = vi.fn()
    render(
      <EditorControls
        template={minimalArcTemplate}
        customizations={baseCustomizations}
        onChange={vi.fn()}
        onExport={onExport}
        exportDisabled={false}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /export/i }))
    expect(onExport).toHaveBeenCalledOnce()
  })

  it('disables export button when exportDisabled is true', () => {
    render(
      <EditorControls
        template={minimalArcTemplate}
        customizations={baseCustomizations}
        onChange={vi.fn()}
        onExport={vi.fn()}
        exportDisabled={true}
      />,
    )
    expect(screen.getByRole('button', { name: /export/i })).toBeDisabled()
  })
})
