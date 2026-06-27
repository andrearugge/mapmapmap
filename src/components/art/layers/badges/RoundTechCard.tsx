import type { ActivityData, Customizations } from '@/types/map-story'
import { formatStat, formatPace } from '@/lib/art/format-stat'

export interface BadgeProps {
  activity: ActivityData
  customizations: Customizations
}

const FONT = "var(--font-pp-supply-mono, 'Courier New', Courier, monospace)"
const CARD_RADIUS = 16
const CARD_PAD = 24

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div
      style={{
        background: '#ffffff',
        borderRadius: CARD_RADIUS,
        padding: CARD_PAD,
        ...style,
      }}
    >
      {children}
    </div>
  )
}

function Divider() {
  return (
    <div style={{ padding: '0 40px', height: 4, flexShrink: 0 }}>
      <div
        style={{
          width: '100%',
          height: 4,
          backgroundImage:
            'repeating-linear-gradient(90deg, currentColor 0, currentColor 8px, transparent 8px, transparent 14px)',
          opacity: 0.25,
        }}
      />
    </div>
  )
}

function StatRow({
  value,
  label,
  color,
}: {
  value: string
  label: string
  color: string
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <p
        style={{
          fontFamily: FONT,
          fontSize: 64,
          fontWeight: 100,
          color,
          letterSpacing: '-2.56px',
          lineHeight: 1,
          margin: 0,
        }}
      >
        {value}
      </p>
      <p
        style={{
          fontFamily: FONT,
          fontSize: 24,
          fontWeight: 400,
          color,
          letterSpacing: '-0.96px',
          textTransform: 'uppercase',
          margin: 0,
        }}
      >
        {label}
      </p>
    </div>
  )
}

export function RoundTechCard({ activity, customizations }: BadgeProps) {
  const color = customizations.primary

  const dateShort = new Date(activity.date).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
  })
  const time = formatStat('movingTime_s', activity)
  const distance = formatStat('distance_m', activity)
  const pace = formatPace(activity.stats.avgSpeed_mps)
  const speed = formatStat('avgSpeed_mps', activity)

  const textBase: React.CSSProperties = {
    fontFamily: FONT,
    fontSize: 24,
    fontWeight: 400,
    color,
    letterSpacing: '-0.96px',
    textTransform: 'uppercase',
    margin: 0,
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: 437 }}>
      {/* Card 1 — Activity name + date/time */}
      <Card>
        <p style={textBase}>{activity.name}</p>
        <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
          <p style={textBase}>{dateShort}</p>
          <p style={textBase}>–</p>
          <p style={textBase}>{time}</p>
        </div>
      </Card>

      <Divider />

      {/* Card 2 — Branding */}
      <Card style={{ display: 'flex', flexDirection: 'column', gap: 80 }}>
        <div>
          <p style={textBase}>Mapmapmap</p>
          <p style={textBase}>Run the way you like</p>
        </div>
        {/* Logo placeholder — replace with <img> once asset is available */}
        <p
          style={{
            fontFamily: FONT,
            fontSize: 28,
            fontWeight: 700,
            color,
            margin: 0,
          }}
        >
          M°
        </p>
      </Card>

      <Divider />

      {/* Card 3 — Stats */}
      <Card style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <StatRow value={distance} label="Distance" color={color} />
        <StatRow value={pace} label="Pace" color={color} />
        <StatRow value={speed} label="Speed" color={color} />
      </Card>
    </div>
  )
}
