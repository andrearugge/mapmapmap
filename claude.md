# CLAUDE.md — Mapmapmap

## Fonte di verità
La specifica v1 completa è in `docs/mapmapmap-v1-spec.md`. È autorevole: leggila prima di pianificare o implementare. Questo file riassume solo i guardrail operativi.

## Invarianti non negoziabili
- `<MapStory>` è una funzione **pura** `(template, activity, customizations) → JSX`: nessun hook di stato, nessun fetch interno, nessun side effect, nessun input implicito (no `Date.now()`, `Math.random()`, letture di env). Deterministico. Usato identico in authoring, editor utente ed export.
- Token di stile **fissi e limitati**: `primary`, `accent`. Non introdurne altri.
- Export **PNG trasparente**. Niente video. Niente overlay in modalità trasparente (spec §6.4).
- "Powered by Strava" sempre presente e **non rimovibile** nel render.
- Scope Strava: **solo `activity:read`**. Mai `activity:read_all`.
- **Next.js "vanilla"**: vietate le feature Vercel-only. Il target di deploy resta portabile (Hetzner/Ploi).
- I contratti dati (spec §6) sono vincolanti.
- Non implementare nulla in "Fuori scope v1" (spec §2).

## Regola di lavoro: chiedi prima di decidere
Se un punto è ambiguo, contraddittorio o non coperto dalla specifica, **fermati e chiedi**. Nessuna assunzione silenziosa su intento, architettura o requisiti. Elenca le domande numerate e attendi risposta prima di procedere su quei punti.

## Definition of Done (vincolante)
Nessun task è completo finché, **nello stesso cambiamento**, non sono aggiornati:
1. Codice + test.
2. Documentazione del codice: TSDoc sulle API pubbliche; README del modulo se l'interfaccia cambia.
3. Wiki: se il cambiamento tocca **comportamento user-facing o architettura**, aggiorna le pagine wiki interessate (e crea un ADR se cambia una decisione).

Un cambiamento che modifica il comportamento **non è completo** se la wiki resta indietro.

## Sistema di documentazione
- `docs/mapmapmap-v1-spec.md` — snapshot di decisioni per la v1. **Non** si aggiorna in continuo.
- `docs/adr/` — Architecture Decision Records: ogni nuova decisione, o modifica di una decisione vincolante, va qui (data, contesto, scelta, alternative scartate).
- `docs/wiki/` — wiki narrativa, fonte viva del "cosa fa l'app": feature, flussi utente, architettura, glossario. Markdown nel repo, versionata col codice.
- **Storybook** — catalogo vivo di Art e componenti. È documentazione visiva: non duplicarla a parole nella wiki.
- **API reference** — generata dai tipi/TSDoc (es. TypeDoc). Non scriverla a mano.
- Ogni pagina `docs/wiki/` dichiara in testa quali **aree di codice** copre (doc map), così è identificabile cosa aggiornare a ogni cambiamento.

## Trigger di aggiornamento doc
- Codice cambia → TSDoc / README di modulo.
- Comportamento user-facing o architettura cambia → pagina/e wiki (+ ADR se cambia una decisione).
- Refactor senza cambi di comportamento → nessun aggiornamento wiki (evita rumore).

## Convenzioni e comandi

### Package manager
**pnpm** sempre. Mai `npm install` o `yarn`.

### Struttura cartelle
```
src/
├── app/                    # Next.js App Router (routes, layouts, API)
│   ├── (user)/             # Area utente autenticata (mobile-first)
│   ├── admin/              # Mini-admin (role-gated, desktop)
│   └── api/                # Route handler API
├── components/
│   ├── ui/                 # shadcn/ui (generati, non editare a mano)
│   ├── art/                # <MapStory> e layer renderer
│   └── editor/             # Componenti editor utente
├── lib/
│   ├── db/                 # Schema Drizzle, migration, client
│   ├── auth/               # Auth.js config, Strava provider
│   ├── strava/             # Strava API client, normalizzazione polyline
│   ├── render/             # Interfaccia Renderer, implementazione Playwright
│   └── art/                # Registro Art, tipo Template
├── stories/                # Storybook stories
└── types/                  # Tipi TypeScript condivisi e overrides
```

### Comandi

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
| DB generate migration | `pnpm db:generate` |
| DB run migration | `pnpm db:migrate` |
| DB studio | `pnpm db:studio` |

### Naming

- Componenti React: PascalCase (`MapStory`, `StravaAttribution`)
- Hooks: camelCase con prefisso `use` (`useMapExport`)
- Utility/lib: camelCase (`normalizePolyline`)
- File componenti: same as component (`MapStory.tsx`)
- Route folders: kebab-case (`activity-picker/`)
- Test files: `*.test.ts` / `*.test.tsx` accanto al file testato, oppure in `src/__tests__/`

### API reference
Generata con TypeDoc: `pnpm typedoc` (configurato in Fase 1). Non scrivere API ref a mano.