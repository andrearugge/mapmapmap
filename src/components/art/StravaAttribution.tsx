import type { Anchor } from '@/types/map-story'

interface Props {
  anchor: Anchor
}

const ANCHOR_STYLE: Record<string, React.CSSProperties> = {
  'top-left':      { top: 48, left: 48 },
  'top-center':    { top: 48, left: '50%', transform: 'translateX(-50%)' },
  'top-right':     { top: 48, right: 48 },
  'middle-left':   { top: '50%', left: 48, transform: 'translateY(-50%)' },
  'middle-center': { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' },
  'middle-right':  { top: '50%', right: 48, transform: 'translateY(-50%)' },
  'bottom-left':   { bottom: 48, left: 48 },
  'bottom-center': { bottom: 48, left: '50%', transform: 'translateX(-50%)' },
  'bottom-right':  { bottom: 48, right: 48 },
}

/**
 * "Powered by Strava" badge. Always present, never removable.
 * Required by Strava ToS (spec §5.3, §6.5).
 */
export function StravaAttribution({ anchor }: Props) {
  return (
    <div
      style={{
        position: 'absolute',
        ...ANCHOR_STYLE[anchor],
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '6px 12px',
        backgroundColor: 'rgba(0,0,0,0.45)',
        borderRadius: 4,
        backdropFilter: 'blur(4px)',
      }}
      aria-label="Powered by Strava"
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
        {/* Strava flame icon (SVG path) */}
        <path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066z" fill="#FC4C02"/>
        <path d="M11.374 14.010l2.062 4.148 2.057-4.148H11.374z" fill="#FC4C02" opacity=".6"/>
      </svg>
      <span
        style={{
          fontFamily: 'system-ui, sans-serif',
          fontSize: 16,
          color: '#fff',
          fontWeight: 600,
          letterSpacing: '0.01em',
          whiteSpace: 'nowrap',
        }}
      >
        Powered by Strava
      </span>
    </div>
  )
}
