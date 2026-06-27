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
