import Link from 'next/link'
import { requireAdmin } from '@/lib/auth/require-admin'

const NAV = [
  { href: '/admin/users', label: 'Users' },
  { href: '/admin/groups', label: 'Groups' },
  { href: '/admin/art', label: 'Art Catalog' },
  { href: '/admin/analytics', label: 'Analytics' },
]

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin()

  return (
    <div className="flex min-h-screen">
      <aside className="w-52 shrink-0 border-r bg-muted/30 px-3 py-5">
        <p className="mb-5 px-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Admin
        </p>
        <nav className="flex flex-col gap-0.5">
          {NAV.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className="rounded-md px-3 py-2 text-sm text-foreground hover:bg-muted"
            >
              {label}
            </Link>
          ))}
        </nav>
      </aside>
      <main className="flex-1 overflow-auto p-8">{children}</main>
    </div>
  )
}
