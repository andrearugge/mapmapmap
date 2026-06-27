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
