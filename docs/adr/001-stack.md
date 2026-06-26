# ADR-001: Stack Tecnologico

**Data:** 2026-06-26
**Stato:** Accepted

## Contesto

Mapmapmap v1 è una web app mobile-first per generare Instagram Story a partire da dati Strava. Target deploy: Hetzner (non Vercel). Stack scelto per minimizzare i provider, massimizzare la portabilità, validare velocemente.

## Decisioni

### Next.js 15 App Router + `output: 'standalone'`
Unica app che ospita landing, area utente, `/admin`, endpoint export. `output: 'standalone'` per deploy Node.js su Ploi senza Docker obbligatorio.
**Alternativa scartata**: Remix — meno maturo sull'ecosistema Drizzle + Auth.js.

### TypeScript 5 strict
Standard. Non negoziabile.

### Tailwind CSS 4 + shadcn/ui
Tailwind 4 (CSS-first, nessun config JS). shadcn/ui per i componenti admin.
**Alternativa scartata**: CSS Modules (verbosi), styled-components (runtime overhead).

### Drizzle ORM + postgres.js
Drizzle: type-safe, migrations esplicite, no query builder "magico". postgres.js: migliore TypeScript support rispetto a `pg`, zero overhead.
**Alternative scartate**: Prisma (schema.prisma duplica i tipi TypeScript, overhead di generazione); Neon/Supabase (DB serverless non necessario con processo Node persistente).

### Auth.js v5 (NextAuth) + Drizzle adapter
Standard de facto per Next.js. Adapter Drizzle disponibile. Strava provider custom (Strava non è incluso nei provider nativi di NextAuth v5).
**Alternative scartate**: Lucia (più boilerplate, meno ecosystem); Clerk (SaaS lock-in, non portabile).

### Storybook 8
Catalogo vivo per lo sviluppo delle Art (componenti 9:16). Addon Viewport per canvas 1080×1920 fisso. Addon Controls per mappare `customizationSchema`.
**Alternativa scartata**: Ladle — nessun addon equivalente per viewport personalizzati e controls da schema Zod.

### Vitest + Testing Library
Vitest: veloce, nessuna configurazione Babel extra, JSX nativo con plugin React.
**Alternativa scartata**: Jest — più lento con Next.js, configurazione SWC/Babel più verbosa.

### pnpm
Deterministic lockfile, più veloce di npm, monorepo-ready se necessario.

## Conseguenze

- Nessuna feature Vercel-only (`@vercel/*`) è ammessa nel codebase.
- `pnpm` è obbligatorio; `npm install` e `yarn` sono vietati.
- Il codebase deve rimanere deployabile su Hetzner senza modifiche strutturali.
