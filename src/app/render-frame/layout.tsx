import type { Metadata } from 'next'

export const metadata: Metadata = { robots: 'noindex' }

export default function RenderFrameLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html>
      <head>
        <style>{`
          * { margin: 0; padding: 0; box-sizing: border-box; }
          html, body { background: transparent; overflow: hidden; }
        `}</style>
      </head>
      <body>{children}</body>
    </html>
  )
}
