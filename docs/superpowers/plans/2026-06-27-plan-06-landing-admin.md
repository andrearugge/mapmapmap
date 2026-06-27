# Plan 06 — Landing Page + Admin Area

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the public landing page with Strava OAuth CTA and the complete admin area — user management (edit role / delete), groups, Art catalog read-only, and minimal analytics dashboard — completing all v1 spec requirements from §2, §8, §10.

**Architecture:** The landing page is a Server Component at `/` that redirects authenticated users to `/activity-picker` and renders a Strava sign-in CTA via an inline Server Action. The admin area lives at `/admin/*` — the existing middleware already requires authentication; each admin Server Component adds a DB-level role check (one `db.select` for `users.role`). User/group mutations are Server Actions (`'use server'` files) called from TanStack Table Client Components. The Art catalog and analytics pages are read-only Server Components. New DB tables for groups, user↔group membership, and Art entitlements are added via a single Drizzle migration.

**Tech Stack:** Next.js 15 App Router (Server Components + Client Components + Server Actions), React 19, TypeScript strict, Tailwind CSS 4, shadcn/ui, `@tanstack/react-table`, Drizzle ORM, Vitest + @testing-library/react.

## Global Constraints

- `<MapStory>` remains pure — this plan does not touch it.
- Admin UI is desktop-only — no mobile-first requirements for admin pages.
- `/admin` routes are role-gated: `role === 'admin'` in the `users` table (already exists). Middleware already enforces auth; each Server Component adds role guard via DB lookup.
- Server Actions must call `await requireAdmin()` as the first statement.
- Analytics must only cover **app metadata** (users, exports) — never Strava activity data (spec §5.3).
- pnpm always. Never `npm install` or `yarn`.
- "Active user" definition (spec §11.4): user with at least 1 completed render job (`render_jobs` with `status = 'done'`).

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Modify | `src/app/page.tsx` | Landing page — Strava CTA, redirect authenticated users |
| Modify | `src/lib/db/schema.ts` | Add `groups`, `userGroups`, `artGroupEntitlements`, `artUserEntitlements` |
| Create | `src/app/admin/layout.tsx` | Admin root layout — DB role guard + sidebar nav |
| Create | `src/app/admin/page.tsx` | Admin root — redirect to /admin/users |
| Create | `src/app/admin/users/page.tsx` | Server Component — fetch users list, pass to UsersTable |
| Create | `src/app/admin/users/actions.ts` | Server Actions: `updateUserRole`, `deleteUser` |
| Create | `src/app/admin/users/__tests__/actions.test.ts` | Unit tests for user Server Actions |
| Create | `src/components/admin/UsersTable.tsx` | Client Component — TanStack Table for users with role toggle + delete |
| Create | `src/app/admin/groups/page.tsx` | Server Component — fetch groups + member counts, pass to GroupsTable |
| Create | `src/app/admin/groups/actions.ts` | Server Actions: `createGroup`, `deleteGroup` |
| Create | `src/app/admin/groups/__tests__/actions.test.ts` | Unit tests for group Server Actions |
| Create | `src/components/admin/GroupsTable.tsx` | Client Component — TanStack Table for groups + create form |
| Create | `src/app/admin/art/page.tsx` | Server Component — Art catalog read-only (templates + entitlements) |
| Create | `src/app/admin/analytics/page.tsx` | Server Component — usage metrics cards |
| Create | `docs/wiki/admin.md` | Admin area documentation |
| Create | `docs/adr/005-admin-desktop-tanstack.md` | ADR: admin stack and analytics choices |

---

## Task 1: Landing Page

**Files:**
- Modify: `src/app/page.tsx`

**Interfaces:**
- Consumes: `auth`, `signIn` from `@/auth`
- Produces: Server Component at `GET /`
  - Redirects authenticated users to `/activity-picker`
  - Renders Strava sign-in CTA via inline Server Action

- [ ] **Step 1.1: Rewrite `src/app/page.tsx`**

```tsx
import { redirect } from 'next/navigation'
import { auth, signIn } from '@/auth'

export default async function LandingPage() {
  const session = await auth()
  if (session) redirect('/activity-picker')

  async function stravaSignIn() {
    'use server'
    await signIn('strava', { redirectTo: '/activity-picker' })
  }

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-8 px-6 text-center">
      <div className="space-y-3">
        <h1 className="text-4xl font-bold tracking-tight">Mapmapmap</h1>
        <p className="text-lg text-muted-foreground">
          Turn your Strava activity into an Instagram Story.
        </p>
      </div>

      <form action={stravaSignIn}>
        <button
          type="submit"
          className="rounded-full bg-[#FC4C02] px-8 py-4 text-base font-semibold text-white shadow-md transition-opacity active:opacity-80"
        >
          Connect with Strava
        </button>
      </form>
    </main>
  )
}
```

- [ ] **Step 1.2: Type-check**

```bash
pnpm type-check
```

Expected: 0 errors.

- [ ] **Step 1.3: Smoke test**

Run `pnpm dev`. Visit `http://localhost:3000`:
- Unauthenticated: see "Mapmapmap" heading + orange "Connect with Strava" button.
- Authenticated (already have a session cookie): should redirect to `/activity-picker`.

- [ ] **Step 1.4: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat: add landing page with Strava sign-in CTA"
```

---

## Task 2: Groups + Entitlement DB Schema

**Files:**
- Modify: `src/lib/db/schema.ts`
- Create: `src/lib/db/migrations/0004_*.sql` (auto-generated)

**Interfaces:**
- Produces:
  - `groups` table: `id`, `name` (unique), `createdAt`
  - `userGroups` junction: `userId` ↔ `groupId` (composite PK)
  - `artGroupEntitlements`: `templateId` + `groupId` (composite PK)
  - `artUserEntitlements`: `templateId` + `userId` (composite PK)

- [ ] **Step 2.1: Add tables to `src/lib/db/schema.ts`**

Append after the last `export const renderJobs = ...` block:

```typescript
export const groups = pgTable('groups', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text('name').notNull().unique(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const userGroups = pgTable(
  'user_groups',
  {
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    groupId: text('group_id')
      .notNull()
      .references(() => groups.id, { onDelete: 'cascade' }),
  },
  (t) => [primaryKey({ columns: [t.userId, t.groupId] })],
)

export const artGroupEntitlements = pgTable(
  'art_group_entitlements',
  {
    templateId: text('template_id').notNull(),
    groupId: text('group_id')
      .notNull()
      .references(() => groups.id, { onDelete: 'cascade' }),
  },
  (t) => [primaryKey({ columns: [t.templateId, t.groupId] })],
)

export const artUserEntitlements = pgTable(
  'art_user_entitlements',
  {
    templateId: text('template_id').notNull(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
  },
  (t) => [primaryKey({ columns: [t.templateId, t.userId] })],
)
```

- [ ] **Step 2.2: Generate migration**

```bash
pnpm db:generate
```

Expected: a new file `src/lib/db/migrations/0004_*.sql` is created. Verify it contains `CREATE TABLE groups`, `CREATE TABLE user_groups`, `CREATE TABLE art_group_entitlements`, `CREATE TABLE art_user_entitlements`.

- [ ] **Step 2.3: Run migration**

```bash
pnpm db:migrate
```

Expected: "Migration completed" (or similar). 0 errors.

- [ ] **Step 2.4: Type-check**

```bash
pnpm type-check
```

Expected: 0 errors.

- [ ] **Step 2.5: Commit**

```bash
git add src/lib/db/schema.ts src/lib/db/migrations/
git commit -m "feat: add groups, user_groups, art_group_entitlements, art_user_entitlements tables"
```

---

## Task 3: Admin Layout + Role Guard

**Files:**
- Create: `src/app/admin/layout.tsx`
- Create: `src/app/admin/page.tsx`

**Interfaces:**
- Consumes: `auth` from `@/auth`, `db` from `@/lib/db`, `users` from `@/lib/db/schema`, `eq` from `drizzle-orm`
- Produces:
  - Admin layout Server Component: DB role check → redirect `/` if not admin; renders sidebar + `{children}`
  - Admin root redirect → `/admin/users`

Note: The existing `src/middleware.ts` already redirects unauthenticated requests to `/` for `/admin/:path*`. The layout adds the role check on top.

- [ ] **Step 3.1: Create `src/app/admin/layout.tsx`**

```tsx
import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import Link from 'next/link'

const NAV = [
  { href: '/admin/users', label: 'Users' },
  { href: '/admin/groups', label: 'Groups' },
  { href: '/admin/art', label: 'Art Catalog' },
  { href: '/admin/analytics', label: 'Analytics' },
]

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session?.user?.id) redirect('/')

  const [dbUser] = await db
    .select({ role: users.role })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1)

  if (dbUser?.role !== 'admin') redirect('/')

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
```

- [ ] **Step 3.2: Create `src/app/admin/page.tsx`**

```tsx
import { redirect } from 'next/navigation'

export default function AdminRoot() {
  redirect('/admin/users')
}
```

- [ ] **Step 3.3: Type-check**

```bash
pnpm type-check
```

Expected: 0 errors.

- [ ] **Step 3.4: Smoke test**

Run `pnpm dev`. Visit `http://localhost:3000/admin` as a non-admin user (role = 'user') — should redirect to `/`. Manually update your user role to 'admin' in DB (`pnpm db:studio`, set `role = 'admin'`), then visit `/admin` — should show the sidebar and redirect to `/admin/users` (which returns 404 until Task 4 — that's expected).

- [ ] **Step 3.5: Commit**

```bash
git add src/app/admin/
git commit -m "feat: add admin layout with DB role guard and sidebar nav"
```

---

## Task 4: Admin Users — Actions + TanStack Table

**Files:**
- Create: `src/app/admin/users/actions.ts`
- Create: `src/app/admin/users/__tests__/actions.test.ts`
- Create: `src/components/admin/UsersTable.tsx`
- Create: `src/app/admin/users/page.tsx`

**Interfaces:**
- Consumes: `db`, `users` from schema, `auth`, `eq` from drizzle-orm, `revalidatePath` from next/cache
- Produces:
  - `updateUserRole(userId: string, role: 'user' | 'admin'): Promise<void>` — Server Action
  - `deleteUser(userId: string): Promise<void>` — Server Action
  - `UsersTable({ users: UserRow[] })` — Client Component with TanStack Table
  - Server Component at `GET /admin/users`

**Guard rules:**
- `updateUserRole`: throws `'Unauthorized'` if caller is not admin; throws `'Cannot remove own admin role'` if targeting self with `role: 'user'`
- `deleteUser`: throws `'Unauthorized'` if caller is not admin; throws `'Cannot delete own account'` if targeting self

- [ ] **Step 4.1: Install @tanstack/react-table**

```bash
pnpm add @tanstack/react-table
```

Expected: package added to `package.json` and `pnpm-lock.yaml`.

- [ ] **Step 4.2: Write failing tests**

Create `src/app/admin/users/__tests__/actions.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/auth', () => ({ auth: vi.fn() }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('next/navigation', () => ({ redirect: vi.fn() }))
vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}))

import { db } from '@/lib/db'
import { auth } from '@/auth'
import { updateUserRole, deleteUser } from '@/app/admin/users/actions'

const stubSelect = (row: Record<string, unknown> | null) =>
  vi.mocked(db.select).mockReturnValue({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue(row ? [row] : []),
      }),
    }),
  } as ReturnType<typeof db.select>)

const stubUpdate = () =>
  vi.mocked(db.update).mockReturnValue({
    set: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(undefined),
    }),
  } as ReturnType<typeof db.update>)

const stubDelete = () =>
  vi.mocked(db.delete).mockReturnValue({
    where: vi.fn().mockResolvedValue(undefined),
  } as ReturnType<typeof db.delete>)

describe('updateUserRole', () => {
  beforeEach(() => vi.clearAllMocks())

  it('throws Unauthorized when caller role is user', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'caller-1' } } as never)
    stubSelect({ role: 'user' })
    await expect(updateUserRole('target-1', 'admin')).rejects.toThrow('Unauthorized')
  })

  it('throws when admin tries to demote themselves', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'admin-1' } } as never)
    stubSelect({ role: 'admin' })
    await expect(updateUserRole('admin-1', 'user')).rejects.toThrow(
      'Cannot remove own admin role',
    )
  })

  it('calls db.update when admin updates another user', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'admin-1' } } as never)
    stubSelect({ role: 'admin' })
    const spy = stubUpdate()
    await updateUserRole('user-2', 'admin')
    expect(spy).toHaveBeenCalled()
  })
})

describe('deleteUser', () => {
  beforeEach(() => vi.clearAllMocks())

  it('throws Unauthorized when caller role is user', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'caller-1' } } as never)
    stubSelect({ role: 'user' })
    await expect(deleteUser('target-1')).rejects.toThrow('Unauthorized')
  })

  it('throws when admin tries to delete themselves', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'admin-1' } } as never)
    stubSelect({ role: 'admin' })
    await expect(deleteUser('admin-1')).rejects.toThrow('Cannot delete own account')
  })

  it('calls db.delete when admin deletes another user', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'admin-1' } } as never)
    stubSelect({ role: 'admin' })
    const spy = stubDelete()
    await deleteUser('user-2')
    expect(spy).toHaveBeenCalled()
  })
})
```

- [ ] **Step 4.3: Run tests to verify they fail**

```bash
pnpm test:run src/app/admin/users/__tests__/actions.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 4.4: Create `src/app/admin/users/actions.ts`**

```typescript
'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { auth } from '@/auth'

async function requireAdmin(): Promise<string> {
  const session = await auth()
  if (!session?.user?.id) redirect('/')

  const [caller] = await db
    .select({ role: users.role })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1)

  if (caller?.role !== 'admin') throw new Error('Unauthorized')
  return session.user.id
}

export async function updateUserRole(userId: string, role: 'user' | 'admin'): Promise<void> {
  const callerId = await requireAdmin()
  if (userId === callerId && role === 'user') throw new Error('Cannot remove own admin role')

  await db.update(users).set({ role, updatedAt: new Date() }).where(eq(users.id, userId))
  revalidatePath('/admin/users')
}

export async function deleteUser(userId: string): Promise<void> {
  const callerId = await requireAdmin()
  if (userId === callerId) throw new Error('Cannot delete own account')

  await db.delete(users).where(eq(users.id, userId))
  revalidatePath('/admin/users')
}
```

- [ ] **Step 4.5: Run tests to verify they pass**

```bash
pnpm test:run src/app/admin/users/__tests__/actions.test.ts
```

Expected: PASS (6 tests).

- [ ] **Step 4.6: Create `src/components/admin/UsersTable.tsx`**

```tsx
'use client'

import { useTransition } from 'react'
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table'
import { updateUserRole, deleteUser } from '@/app/admin/users/actions'

export type UserRow = {
  id: string
  name: string
  handle: string | null
  role: 'user' | 'admin'
  createdAt: Date
}

const columnHelper = createColumnHelper<UserRow>()

interface UsersTableProps {
  users: UserRow[]
}

export function UsersTable({ users }: UsersTableProps) {
  const [isPending, startTransition] = useTransition()

  const columns = [
    columnHelper.accessor('name', { header: 'Name' }),
    columnHelper.accessor('handle', {
      header: 'Handle',
      cell: (info) => info.getValue() ?? '—',
    }),
    columnHelper.accessor('role', {
      header: 'Role',
      cell: (info) => {
        const row = info.row.original
        const isAdmin = info.getValue() === 'admin'
        return (
          <button
            type="button"
            onClick={() =>
              startTransition(async () => {
                await updateUserRole(row.id, isAdmin ? 'user' : 'admin')
              })
            }
            className={`rounded-full px-2 py-0.5 text-xs font-medium transition-colors ${
              isAdmin ? 'bg-amber-100 text-amber-800' : 'bg-gray-100 text-gray-700'
            }`}
          >
            {isAdmin ? 'admin' : 'user'}
          </button>
        )
      },
    }),
    columnHelper.accessor('createdAt', {
      header: 'Joined',
      cell: (info) => info.getValue().toLocaleDateString('it-IT'),
    }),
    columnHelper.display({
      id: 'actions',
      cell: (info) => (
        <button
          type="button"
          onClick={() => {
            if (!confirm(`Delete ${info.row.original.name}? This cannot be undone.`)) return
            startTransition(async () => {
              await deleteUser(info.row.original.id)
            })
          }}
          className="text-xs text-destructive hover:underline"
        >
          Delete
        </button>
      ),
    }),
  ]

  const table = useReactTable({
    data: users,
    columns,
    getCoreRowModel: getCoreRowModel(),
  })

  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-sm">
        <thead className="bg-muted/50">
          {table.getHeaderGroups().map((hg) => (
            <tr key={hg.id}>
              {hg.headers.map((h) => (
                <th
                  key={h.id}
                  className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground"
                >
                  {flexRender(h.column.columnDef.header, h.getContext())}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row) => (
            <tr key={row.id} className="border-t last:border-b-0">
              {row.getVisibleCells().map((cell) => (
                <td key={cell.id} className="px-4 py-3">
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))}
          {table.getRowModel().rows.length === 0 && (
            <tr>
              <td colSpan={columns.length} className="px-4 py-8 text-center text-muted-foreground">
                No users yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
      {isPending && (
        <p className="border-t px-4 py-2 text-xs text-muted-foreground">Saving…</p>
      )}
    </div>
  )
}
```

- [ ] **Step 4.7: Create `src/app/admin/users/page.tsx`**

```tsx
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { desc } from 'drizzle-orm'
import { UsersTable } from '@/components/admin/UsersTable'
import type { UserRow } from '@/components/admin/UsersTable'

export default async function AdminUsersPage() {
  const rows = await db
    .select({
      id: users.id,
      name: users.name,
      handle: users.handle,
      role: users.role,
      createdAt: users.createdAt,
    })
    .from(users)
    .orderBy(desc(users.createdAt))

  const userRows: UserRow[] = rows.map((r) => ({
    id: r.id,
    name: r.name,
    handle: r.handle,
    role: r.role,
    createdAt: r.createdAt,
  }))

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Users</h1>
        <p className="text-sm text-muted-foreground">{rows.length} registered</p>
      </div>
      <UsersTable users={userRows} />
    </div>
  )
}
```

- [ ] **Step 4.8: Run all tests + type-check**

```bash
pnpm test:run && pnpm type-check
```

Expected: all tests pass, 0 type errors.

- [ ] **Step 4.9: Commit**

```bash
git add src/app/admin/users/ src/components/admin/UsersTable.tsx
git commit -m "feat: add admin users page with TanStack Table, role toggle, and delete"
```

---

## Task 5: Admin Groups — Actions + Table

**Files:**
- Create: `src/app/admin/groups/actions.ts`
- Create: `src/app/admin/groups/__tests__/actions.test.ts`
- Create: `src/components/admin/GroupsTable.tsx`
- Create: `src/app/admin/groups/page.tsx`

**Interfaces:**
- Consumes: `db`, `users`, `groups` from schema, `auth`, `eq` from drizzle-orm
- Produces:
  - `createGroup(name: string): Promise<void>` — Server Action; throws `'Group name is required'` if empty; throws `'Unauthorized'` if caller is not admin
  - `deleteGroup(groupId: string): Promise<void>` — Server Action; throws `'Unauthorized'` if caller is not admin
  - `GroupsTable({ groups: GroupRow[] })` — Client Component
  - Server Component at `GET /admin/groups`

```typescript
type GroupRow = { id: string; name: string; memberCount: number; createdAt: Date }
```

- [ ] **Step 5.1: Write failing tests**

Create `src/app/admin/groups/__tests__/actions.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/auth', () => ({ auth: vi.fn() }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('next/navigation', () => ({ redirect: vi.fn() }))
vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    delete: vi.fn(),
  },
}))

import { db } from '@/lib/db'
import { auth } from '@/auth'
import { createGroup, deleteGroup } from '@/app/admin/groups/actions'

const stubSelectAdmin = () =>
  vi.mocked(db.select).mockReturnValue({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue([{ role: 'admin' }]),
      }),
    }),
  } as ReturnType<typeof db.select>)

const stubSelectUser = () =>
  vi.mocked(db.select).mockReturnValue({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue([{ role: 'user' }]),
      }),
    }),
  } as ReturnType<typeof db.select>)

const stubInsert = () =>
  vi.mocked(db.insert).mockReturnValue({
    values: vi.fn().mockResolvedValue(undefined),
  } as ReturnType<typeof db.insert>)

const stubDelete = () =>
  vi.mocked(db.delete).mockReturnValue({
    where: vi.fn().mockResolvedValue(undefined),
  } as ReturnType<typeof db.delete>)

describe('createGroup', () => {
  beforeEach(() => vi.clearAllMocks())

  it('throws Unauthorized when caller is not admin', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'caller-1' } } as never)
    stubSelectUser()
    await expect(createGroup('Beta Users')).rejects.toThrow('Unauthorized')
  })

  it('throws when name is empty', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'admin-1' } } as never)
    stubSelectAdmin()
    await expect(createGroup('  ')).rejects.toThrow('Group name is required')
  })

  it('calls db.insert when admin creates valid group', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'admin-1' } } as never)
    stubSelectAdmin()
    const spy = stubInsert()
    await createGroup('Beta Users')
    expect(spy).toHaveBeenCalled()
  })
})

describe('deleteGroup', () => {
  beforeEach(() => vi.clearAllMocks())

  it('throws Unauthorized when caller is not admin', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'caller-1' } } as never)
    stubSelectUser()
    await expect(deleteGroup('group-1')).rejects.toThrow('Unauthorized')
  })

  it('calls db.delete when admin deletes a group', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'admin-1' } } as never)
    stubSelectAdmin()
    const spy = stubDelete()
    await deleteGroup('group-1')
    expect(spy).toHaveBeenCalled()
  })
})
```

- [ ] **Step 5.2: Run tests to verify they fail**

```bash
pnpm test:run src/app/admin/groups/__tests__/actions.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 5.3: Create `src/app/admin/groups/actions.ts`**

```typescript
'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { users, groups } from '@/lib/db/schema'
import { auth } from '@/auth'

async function requireAdmin(): Promise<void> {
  const session = await auth()
  if (!session?.user?.id) redirect('/')

  const [caller] = await db
    .select({ role: users.role })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1)

  if (caller?.role !== 'admin') throw new Error('Unauthorized')
}

export async function createGroup(name: string): Promise<void> {
  await requireAdmin()
  if (!name.trim()) throw new Error('Group name is required')

  await db.insert(groups).values({ name: name.trim() })
  revalidatePath('/admin/groups')
}

export async function deleteGroup(groupId: string): Promise<void> {
  await requireAdmin()
  await db.delete(groups).where(eq(groups.id, groupId))
  revalidatePath('/admin/groups')
}
```

- [ ] **Step 5.4: Run tests to verify they pass**

```bash
pnpm test:run src/app/admin/groups/__tests__/actions.test.ts
```

Expected: PASS (5 tests).

- [ ] **Step 5.5: Create `src/components/admin/GroupsTable.tsx`**

```tsx
'use client'

import { useRef, useTransition } from 'react'
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table'
import { createGroup, deleteGroup } from '@/app/admin/groups/actions'

export type GroupRow = {
  id: string
  name: string
  memberCount: number
  createdAt: Date
}

const columnHelper = createColumnHelper<GroupRow>()

interface GroupsTableProps {
  groups: GroupRow[]
}

export function GroupsTable({ groups }: GroupsTableProps) {
  const [isPending, startTransition] = useTransition()
  const inputRef = useRef<HTMLInputElement>(null)

  const columns = [
    columnHelper.accessor('name', { header: 'Name' }),
    columnHelper.accessor('memberCount', { header: 'Members' }),
    columnHelper.accessor('createdAt', {
      header: 'Created',
      cell: (info) => info.getValue().toLocaleDateString('it-IT'),
    }),
    columnHelper.display({
      id: 'actions',
      cell: (info) => (
        <button
          type="button"
          onClick={() => {
            if (!confirm(`Delete group "${info.row.original.name}"? This cannot be undone.`)) return
            startTransition(async () => {
              await deleteGroup(info.row.original.id)
            })
          }}
          className="text-xs text-destructive hover:underline"
        >
          Delete
        </button>
      ),
    }),
  ]

  const table = useReactTable({
    data: groups,
    columns,
    getCoreRowModel: getCoreRowModel(),
  })

  function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    const name = inputRef.current?.value.trim() ?? ''
    if (!name) return
    startTransition(async () => {
      await createGroup(name)
      if (inputRef.current) inputRef.current.value = ''
    })
  }

  return (
    <div className="space-y-4">
      <form onSubmit={handleCreate} className="flex gap-2">
        <input
          ref={inputRef}
          type="text"
          placeholder="New group name"
          className="rounded-md border px-3 py-1.5 text-sm"
          required
        />
        <button
          type="submit"
          disabled={isPending}
          className="rounded-md bg-foreground px-4 py-1.5 text-sm font-medium text-background disabled:opacity-50"
        >
          Create
        </button>
      </form>

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                {hg.headers.map((h) => (
                  <th
                    key={h.id}
                    className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground"
                  >
                    {flexRender(h.column.columnDef.header, h.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr key={row.id} className="border-t">
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="px-4 py-3">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
            {table.getRowModel().rows.length === 0 && (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-4 py-8 text-center text-muted-foreground"
                >
                  No groups yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        {isPending && (
          <p className="border-t px-4 py-2 text-xs text-muted-foreground">Saving…</p>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 5.6: Create `src/app/admin/groups/page.tsx`**

```tsx
import { db } from '@/lib/db'
import { groups, userGroups } from '@/lib/db/schema'
import { count, eq, desc } from 'drizzle-orm'
import { GroupsTable } from '@/components/admin/GroupsTable'
import type { GroupRow } from '@/components/admin/GroupsTable'

export default async function AdminGroupsPage() {
  const rows = await db
    .select({
      id: groups.id,
      name: groups.name,
      createdAt: groups.createdAt,
      memberCount: count(userGroups.userId),
    })
    .from(groups)
    .leftJoin(userGroups, eq(groups.id, userGroups.groupId))
    .groupBy(groups.id, groups.name, groups.createdAt)
    .orderBy(desc(groups.createdAt))

  const groupRows: GroupRow[] = rows.map((r) => ({
    id: r.id,
    name: r.name,
    createdAt: r.createdAt,
    memberCount: r.memberCount,
  }))

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Groups</h1>
        <p className="text-sm text-muted-foreground">{rows.length} groups</p>
      </div>
      <GroupsTable groups={groupRows} />
    </div>
  )
}
```

- [ ] **Step 5.7: Run all tests + type-check**

```bash
pnpm test:run && pnpm type-check
```

Expected: all tests pass, 0 type errors.

- [ ] **Step 5.8: Commit**

```bash
git add src/app/admin/groups/ src/components/admin/GroupsTable.tsx
git commit -m "feat: add admin groups page with create/delete and TanStack Table"
```

---

## Task 6: Admin Art Catalog (Read-Only)

**Files:**
- Create: `src/app/admin/art/page.tsx`

**Interfaces:**
- Consumes: `artRegistry` from `@/lib/art/registry`, `db`, `artGroupEntitlements`, `artUserEntitlements`, `groups`, `users` from schema
- Produces: Server Component at `GET /admin/art` — lists all registered templates; for each shows group/user entitlements from DB (read-only)

- [ ] **Step 6.1: Create `src/app/admin/art/page.tsx`**

```tsx
import { db } from '@/lib/db'
import { artGroupEntitlements, artUserEntitlements, groups, users } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { artRegistry } from '@/lib/art/registry'

export default async function AdminArtPage() {
  const templates = Array.from(artRegistry.values())

  // Fetch all entitlement rows with names
  const groupEnts = await db
    .select({
      templateId: artGroupEntitlements.templateId,
      groupName: groups.name,
    })
    .from(artGroupEntitlements)
    .innerJoin(groups, eq(artGroupEntitlements.groupId, groups.id))

  const userEnts = await db
    .select({
      templateId: artUserEntitlements.templateId,
      userName: users.name,
    })
    .from(artUserEntitlements)
    .innerJoin(users, eq(artUserEntitlements.userId, users.id))

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Art Catalog</h1>
        <p className="text-sm text-muted-foreground">
          {templates.length} registered template{templates.length !== 1 ? 's' : ''}. Entitlements
          are read-only in v1 — all templates are available to all users by default.
        </p>
      </div>

      <div className="space-y-3">
        {templates.map((t) => {
          const tGroupEnts = groupEnts.filter((e) => e.templateId === t.id)
          const tUserEnts = userEnts.filter((e) => e.templateId === t.id)

          return (
            <div key={t.id} className="rounded-lg border p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">{t.name}</p>
                  <p className="text-xs text-muted-foreground font-mono">{t.id}</p>
                </div>
                <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-800">
                  Public
                </span>
              </div>
              {(tGroupEnts.length > 0 || tUserEnts.length > 0) && (
                <div className="mt-3 space-y-1 text-xs text-muted-foreground">
                  {tGroupEnts.length > 0 && (
                    <p>Groups: {tGroupEnts.map((e) => e.groupName).join(', ')}</p>
                  )}
                  {tUserEnts.length > 0 && (
                    <p>Users: {tUserEnts.map((e) => e.userName).join(', ')}</p>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
```

- [ ] **Step 6.2: Type-check**

```bash
pnpm type-check
```

Expected: 0 errors.

- [ ] **Step 6.3: Commit**

```bash
git add src/app/admin/art/
git commit -m "feat: add admin Art catalog page (read-only)"
```

---

## Task 7: Admin Analytics Dashboard

**Files:**
- Create: `src/app/admin/analytics/page.tsx`

**Interfaces:**
- Consumes: `db`, `users`, `renderJobs` from schema, `count`, `gte`, `and`, `eq` from drizzle-orm
- Produces: Server Component at `GET /admin/analytics` — 4 metric cards
  - **Total users**: `COUNT(*) FROM users`
  - **New users (30 days)**: `COUNT(*) FROM users WHERE created_at >= 30 days ago`
  - **Total exports**: `COUNT(*) FROM render_jobs WHERE status = 'done'`
  - **Exports (7 days)**: `COUNT(*) FROM render_jobs WHERE status = 'done' AND created_at >= 7 days ago`
  - **Active users**: `COUNT(DISTINCT user_id) FROM render_jobs WHERE status = 'done'`

- [ ] **Step 7.1: Create `src/app/admin/analytics/page.tsx`**

```tsx
import { db } from '@/lib/db'
import { users, renderJobs } from '@/lib/db/schema'
import { count, countDistinct, gte, and, eq } from 'drizzle-orm'

export default async function AdminAnalyticsPage() {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

  const [
    [{ totalUsers }],
    [{ newUsers30d }],
    [{ totalExports }],
    [{ exports7d }],
    [{ activeUsers }],
  ] = await Promise.all([
    db.select({ totalUsers: count() }).from(users),
    db
      .select({ newUsers30d: count() })
      .from(users)
      .where(gte(users.createdAt, thirtyDaysAgo)),
    db
      .select({ totalExports: count() })
      .from(renderJobs)
      .where(eq(renderJobs.status, 'done')),
    db
      .select({ exports7d: count() })
      .from(renderJobs)
      .where(and(eq(renderJobs.status, 'done'), gte(renderJobs.createdAt, sevenDaysAgo))),
    db
      .select({ activeUsers: countDistinct(renderJobs.userId) })
      .from(renderJobs)
      .where(eq(renderJobs.status, 'done')),
  ])

  const metrics = [
    { label: 'Total users', value: totalUsers },
    { label: 'New users (30 d)', value: newUsers30d },
    { label: 'Active users (≥1 export)', value: activeUsers },
    { label: 'Total exports', value: totalExports },
    { label: 'Exports (7 d)', value: exports7d },
  ]

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Analytics</h1>
      <p className="text-sm text-muted-foreground">
        App metadata only — no Strava activity data.
      </p>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        {metrics.map(({ label, value }) => (
          <div key={label} className="rounded-lg border p-4">
            <p className="text-2xl font-bold tabular-nums">{value}</p>
            <p className="mt-1 text-xs text-muted-foreground">{label}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 7.2: Type-check**

```bash
pnpm type-check
```

Expected: 0 errors. If `countDistinct` is not exported by the drizzle-orm version installed, use `sql<number>\`COUNT(DISTINCT ${renderJobs.userId})\`` instead:

```tsx
import { sql } from 'drizzle-orm'
// Replace countDistinct call with:
db.select({ activeUsers: sql<number>`COUNT(DISTINCT ${renderJobs.userId})` })
  .from(renderJobs)
  .where(eq(renderJobs.status, 'done'))
```

- [ ] **Step 7.3: Commit**

```bash
git add src/app/admin/analytics/
git commit -m "feat: add admin analytics dashboard with 5 usage metrics"
```

---

## Task 8: Documentation

**Files:**
- Create: `docs/wiki/admin.md`
- Create: `docs/adr/005-admin-desktop-tanstack.md`

- [ ] **Step 8.1: Create `docs/wiki/admin.md`**

```markdown
# Admin Area

<!-- doc map: src/app/admin/, src/components/admin/, src/app/admin/users/actions.ts, src/app/admin/groups/actions.ts -->

## Overview

The admin area lives at `/admin` and is gated by `role = 'admin'` in the `users` table. The middleware (`src/middleware.ts`) enforces authentication; each admin Server Component performs an additional DB-level role check via `requireAdmin()`.

Access is granted by setting a user's `role` column to `'admin'` directly in the database (`pnpm db:studio`). There is no self-serve admin elevation.

## Route Map

| Route | Component | Description |
|-------|-----------|-------------|
| `/admin` | `src/app/admin/page.tsx` | Redirect to `/admin/users` |
| `/admin/users` | `src/app/admin/users/page.tsx` | User list with role toggle + delete |
| `/admin/groups` | `src/app/admin/groups/page.tsx` | Group list with create/delete |
| `/admin/art` | `src/app/admin/art/page.tsx` | Art catalog + entitlements (read-only) |
| `/admin/analytics` | `src/app/admin/analytics/page.tsx` | Usage metric cards |

## Layout

`src/app/admin/layout.tsx` — Server Component. Reads `session.user.id` from Auth.js, queries `users.role` from DB, redirects to `/` if role is not `'admin'`. Renders a fixed sidebar nav + `{children}`.

## User Management

`src/app/admin/users/page.tsx` + `src/components/admin/UsersTable.tsx`

The users page fetches all users ordered by `created_at DESC` and passes them to `UsersTable`, a Client Component using TanStack Table. Two Server Actions (`src/app/admin/users/actions.ts`) handle mutations:

- **`updateUserRole(userId, role)`** — toggles a user between `'user'` and `'admin'`. Guards: caller must be admin; admin cannot demote themselves.
- **`deleteUser(userId)`** — cascades via FK to delete the user's sessions, accounts, activities, and render jobs. Guard: admin cannot delete themselves.

Both call `revalidatePath('/admin/users')` after mutation so the page refreshes via React Server Components.

## Groups

`src/app/admin/groups/page.tsx` + `src/components/admin/GroupsTable.tsx`

Groups are for future entitlement management. In v1 the admin can create and delete groups. User ↔ group membership is managed directly in the DB (no UI in v1).

Server Actions (`src/app/admin/groups/actions.ts`):
- **`createGroup(name)`** — inserts into `groups`. Throws if name is blank.
- **`deleteGroup(groupId)`** — cascades to `user_groups` and `art_group_entitlements` via FK.

## Art Catalog

`src/app/admin/art/page.tsx`

Read-only in v1. Lists all templates registered in `artRegistry` (`src/lib/art/registry.ts`). For each template, queries `art_group_entitlements` and `art_user_entitlements` to show any restricted entitlements. In v1, no entitlements are seeded — all templates are effectively public.

## Analytics

`src/app/admin/analytics/page.tsx`

Five metric cards, all computed server-side with Drizzle aggregate queries at request time (no caching layer in v1):

| Metric | Source |
|--------|--------|
| Total users | `COUNT(*) FROM users` |
| New users (30 d) | `COUNT(*) FROM users WHERE created_at >= 30 d ago` |
| Active users (≥1 export) | `COUNT(DISTINCT user_id) FROM render_jobs WHERE status = 'done'` |
| Total exports | `COUNT(*) FROM render_jobs WHERE status = 'done'` |
| Exports (7 d) | `COUNT(*) FROM render_jobs WHERE status = 'done' AND created_at >= 7 d ago` |

Analytics cover **app metadata only** — no Strava activity data (spec §5.3).

## DB Schema (added in Plan 06)

```
groups             id, name (unique), created_at
user_groups        (user_id, group_id) PK — many-to-many
art_group_entitlements  (template_id, group_id) PK
art_user_entitlements   (template_id, user_id) PK
```

All new tables cascade-delete when their referenced user or group is deleted.
```

- [ ] **Step 8.2: Create `docs/adr/005-admin-desktop-tanstack.md`**

```markdown
# ADR-005 — Admin Stack: Desktop Layout, TanStack Table, Server Actions

**Date:** 2026-06-27
**Status:** Accepted

## Context

The admin area needs tabular views of users and groups with inline mutations (role toggle, delete, create group). The spec (§3) mandates Tailwind + shadcn/ui and TanStack Table for admin. The area is desktop-only (§1: "L'admin è su desktop").

## Decision: TanStack Table for data tables

TanStack Table (headless) provides sorting, filtering, and column definitions without locking in a specific HTML structure. We bring our own Tailwind-styled `<table>` markup.

**Alternative: shadcn/ui DataTable.** This is just TanStack Table wrapped in shadcn components. Acceptable, but the shadcn generator adds boilerplate we don't need for v1's two simple tables. Using `@tanstack/react-table` directly keeps it minimal.

**Alternative: plain `<table>` with no library.** Fine for v1 read-only tables. Rejected because sorting/filtering will be needed soon after launch and TanStack Table is the spec-mandated choice.

## Decision: Server Actions for mutations

Mutations (updateUserRole, deleteUser, createGroup, deleteGroup) are implemented as `'use server'` functions called directly from Client Components via `useTransition`. This avoids building separate API routes for admin operations.

Each Server Action calls `requireAdmin()` as its first statement — an explicit DB-level authorization check (not just a session claim). This means a compromised session token cannot escalate privileges without a matching DB row.

**Alternative: Route Handlers (POST /api/admin/...).** More verbose, requires manual fetch calls and loading state management. Server Actions + `useTransition` achieve the same result with less code.

## Decision: DB role lookup in admin layout (not session claim)

The admin layout does a `db.select({ role }) FROM users WHERE id = session.user.id` on every admin page load. This trades one extra DB round-trip for accurate, unforgeable role enforcement.

**Alternative: include role in Auth.js session callback.** Would require modifying `src/auth.ts` and extending session types. The DB lookup is one query at ~1 ms on a co-located Postgres — acceptable for admin pages which are low-traffic.

## Decision: "Active user" definition

Spec §11.4 leaves the definition open. Chosen: **users with at least 1 completed render job**. Rationale: a user who signed in but never exported anything has not validated the product hypothesis. A completed export is the meaningful action.

## Decision: Entitlement model but no management UI in v1

`art_group_entitlements` and `art_user_entitlements` tables are created now so the data model is in place. In v1 the admin can only read them. Adding/editing entitlements via UI is post-v1 work; the schema won't change.

## Consequences

- Every admin page load costs one extra DB query for the role check. Acceptable for low-traffic admin.
- Server Actions are co-located with their pages (`src/app/admin/users/actions.ts`) rather than in `src/lib/` — they are page-specific mutations, not shared library functions.
- TanStack Table is now a dependency. It is not used outside the admin area.
```

- [ ] **Step 8.3: Run full test suite + type-check + lint**

```bash
pnpm test:run && pnpm type-check && pnpm lint
```

Expected: all tests pass, 0 type errors, 0 lint errors. Test count ≈ 74 (Plan 05) + 11 (Plan 06 actions) = ~85 total.

- [ ] **Step 8.4: End-to-end admin smoke test**

Run `pnpm dev`. Ensure your user has `role = 'admin'` in DB. Visit `http://localhost:3000/admin`:
1. `/admin/users` — see yourself in the table. "Delete" button should confirm before acting.
2. `/admin/groups` — create a test group via the form. It appears in the table. Delete it.
3. `/admin/art` — see "Minimal Arc" listed as "Public" with no entitlements.
4. `/admin/analytics` — see 5 metric cards with real counts.

- [ ] **Step 8.5: Commit**

```bash
git add docs/wiki/admin.md docs/adr/005-admin-desktop-tanstack.md
git commit -m "docs: admin wiki page and ADR-005 admin stack choices"
```

---

## Self-Review

**Spec coverage check:**

| Spec requirement | Task |
|---|---|
| §2 — Landing page with CTA "Connect with Strava" | Task 1 |
| §2 — Login only via Strava OAuth | Task 1 (signIn('strava')) |
| §2 — Mini-admin: user management (edit/delete) | Task 4 |
| §2 — Mini-admin: group creation | Task 5 |
| §2 — Mini-admin: analytics dashboard minimal | Task 7 |
| §2 — Mini-admin: Art section read-only | Task 6 |
| §2 — Entitlement model modelled in data from day 1 | Task 2 (art_group_entitlements, art_user_entitlements) |
| §3 — Tailwind + shadcn/ui for admin | All admin components |
| §3 — TanStack Table for tables | Tasks 4, 5 |
| §8 — `/admin` role-gated (role: admin in DB) | Task 3 (layout DB role check) |
| §8 — Analytics on app metadata only, never Strava data | Task 7 (users + render_jobs only) |
| §10 — Entitlement model: template ↔ group, template ↔ user | Task 2 (two separate junction tables) |
| §5.3 — No Strava activity data in analytics | Task 7 |

**Placeholder scan:** No TBDs, TODOs, or forward references. All code blocks are complete.

**Type consistency check:**
- `UserRow = { id, name, handle, role, createdAt }` — defined in `UsersTable.tsx`, produced by `users/page.tsx`, matches `users` table columns.
- `GroupRow = { id, name, memberCount, createdAt }` — defined in `GroupsTable.tsx`, produced by `groups/page.tsx` aggregate query.
- `updateUserRole(userId: string, role: 'user' | 'admin')` — defined in `actions.ts`, called in `UsersTable.tsx` via `useTransition`.
- `deleteUser(userId: string)` — defined in `actions.ts`, called in `UsersTable.tsx`.
- `createGroup(name: string)` — defined in `actions.ts`, called in `GroupsTable.tsx`.
- `deleteGroup(groupId: string)` — defined in `actions.ts`, called in `GroupsTable.tsx`.
- `artRegistry` typed as `Map<string, Template>` — used in `admin/art/page.tsx` with `Array.from(artRegistry.values())`.
- `renderJobs.status` compared via `eq(renderJobs.status, 'done')` — 'done' is a valid enum value in `renderJobStatusEnum`.
