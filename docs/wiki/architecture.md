---
doc-map:
  areas: [next.config.ts, src/lib/db/, src/auth.ts, .storybook/]
  last-updated: 2026-06-26
  updated-by: plan-01-foundation
---

# Architecture

## Stack

| Layer | Technology | Version |
|---|---|---|
| Framework | Next.js App Router | 15 |
| Language | TypeScript (strict) | 5 |
| Styling | Tailwind CSS 4 + shadcn/ui | 4 |
| ORM | Drizzle ORM | 0.38+ |
| DB driver | postgres.js | 3 |
| Auth | Auth.js v5 (NextAuth) | 5 beta |
| Component dev | Storybook | 8 |
| Test | Vitest + Testing Library | 3 |
| Package mgr | pnpm | 9 |

## Hosting

- **Server**: Hetzner CPX21/CPX31, managed via ploi.io
- **CDN / DNS / SSL**: Cloudflare
- **Object storage**: Cloudflare R2 (S3-compatible, no egress fee)
- **Postgres**: co-locato sulla stessa box, `max: 10` connections, nessun PgBouncer

## Deployment model

`next build` → `output: 'standalone'` → deployato su Ploi come processo Node.js.
Stessa app per: landing, area utente, `/admin`, API export.

## Architectural principles

- **No Vercel-only features** — il target è Hetzner; il codebase non tocca mai `@vercel/*`.
- **Postgres co-locato** — processo Node persistente → pool normale, latenza sub-ms.
- **Render worker isolato** — `<MapStory>` è una funzione pura; lo screenshot (Playwright) gira in coda (pg-boss) con concorrenza = vCPU.

## Related ADRs

- [ADR-001: Stack](../adr/001-stack.md)
