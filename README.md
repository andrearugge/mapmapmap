# Mapmapmap

Trasforma la tua attività Strava in una Instagram Story.

## Requisiti

- Node.js ≥ 20
- pnpm 9
- Docker Desktop

## Setup iniziale

```bash
cp .env.local.example .env.local
# Compila DATABASE_URL e le altre variabili in .env.local
```

## Sviluppo

**1. Avvia il database**

```bash
docker compose up -d db
```

**2. Avvia il dev server**

```bash
pnpm dev
```

App disponibile su http://localhost:3000.

**Fine sessione** (opzionale — i dati persistono nel volume):

```bash
docker compose down
```

## Migration

**Dopo aver modificato lo schema** (`src/lib/db/schema.ts`):

```bash
pnpm db:generate              # genera il file SQL in src/lib/db/migrations/
docker compose run --rm migrate   # applica la migration al DB
```

**Primo setup** (database vuoto, nessuna migration applicata):

```bash
docker compose run --rm migrate
```

## Comandi

| Azione | Comando |
|---|---|
| Dev server | `pnpm dev` |
| Type check | `pnpm type-check` |
| Lint | `pnpm lint` |
| Test (watch) | `pnpm test` |
| Test (CI) | `pnpm test:run` |
| Build | `pnpm build` |
| Storybook | `pnpm storybook` |
| Storybook build | `pnpm storybook:build` |
| DB genera migration | `pnpm db:generate` |
| DB applica migration | `docker compose run --rm migrate` |
| DB studio | `pnpm db:studio` |

## Documentazione

- [`docs/mapmapmap-v1-spec.md`](docs/mapmapmap-v1-spec.md) — specifica v1
- [`docs/wiki/`](docs/wiki/) — architettura e flussi
- [`docs/adr/`](docs/adr/) — Architecture Decision Records
