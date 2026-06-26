import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Mapmapmap',
  description: 'Turn your Strava activity into an Instagram Story.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="it">
      <body>{children}</body>
    </html>
  )
}
