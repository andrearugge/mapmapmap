'use client'

import type { Anchor, Customizations, Template } from '@/types/map-story'

const ANCHOR_LABELS: Record<Anchor, string> = {
  'top-left': 'Top L',
  'top-center': 'Top',
  'top-right': 'Top R',
  'middle-left': 'Mid L',
  'middle-center': 'Center',
  'middle-right': 'Mid R',
  'bottom-left': 'Bot L',
  'bottom-center': 'Bottom',
  'bottom-right': 'Bot R',
}

interface EditorControlsProps {
  template: Template
  customizations: Customizations
  onChange: (c: Customizations) => void
  onExport: () => void
  exportDisabled: boolean
}

export function EditorControls({
  template,
  customizations,
  onChange,
  onExport,
  exportDisabled,
}: EditorControlsProps) {
  function handleColorChange(field: 'primary' | 'accent', value: string) {
    if (/^#[0-9A-Fa-f]{6}$/.test(value)) {
      onChange({ ...customizations, [field]: value })
    }
  }

  return (
    <div className="border-t bg-background px-4 py-5 space-y-5">
      {/* Colour controls */}
      <div className="flex gap-6">
        {(['primary', 'accent'] as const).map((field) => (
          <label key={field} className="flex flex-col gap-1 flex-1">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              {field === 'primary' ? 'Primary' : 'Accent'}
            </span>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={customizations[field]}
                onChange={(e) => handleColorChange(field, e.target.value)}
                className="h-8 w-8 cursor-pointer rounded border p-0"
                aria-label={`${field} color picker`}
              />
              <input
                type="text"
                data-testid={`color-input-${field}`}
                value={customizations[field]}
                onChange={(e) => handleColorChange(field, e.target.value)}
                maxLength={7}
                className="w-24 rounded border px-2 py-1 text-sm font-mono"
                aria-label={`${field} hex value`}
              />
            </div>
          </label>
        ))}
      </div>

      {/* Position controls */}
      <div className="flex flex-col gap-2">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Position
        </span>
        <div data-testid="position-controls" className="flex flex-wrap gap-2">
          {template.allowedAnchors.map((anchor) => (
            <button
              key={anchor}
              type="button"
              data-testid={`anchor-button-${anchor}`}
              onClick={() => onChange({ ...customizations, artPosition: anchor })}
              className={[
                'rounded-full border px-3 py-1.5 text-sm transition-colors min-h-[44px]',
                customizations.artPosition === anchor
                  ? 'border-foreground bg-foreground text-background'
                  : 'border-border bg-background text-foreground',
              ].join(' ')}
            >
              {ANCHOR_LABELS[anchor]}
            </button>
          ))}
        </div>
      </div>

      {/* Export button */}
      <button
        type="button"
        onClick={onExport}
        disabled={exportDisabled}
        className="w-full min-h-[44px] rounded-lg bg-foreground py-3 text-sm font-semibold text-background disabled:opacity-50"
      >
        Export PNG
      </button>
    </div>
  )
}
