# ADR-002: MapStory Purity Invariant

**Data:** 2026-06-26
**Stato:** Accepted

## Contesto

`<MapStory>` è il componente centrale di Mapmapmap. Viene usato in tre contesti: strumento di authoring (Storybook), editor utente (preview live), export server (Playwright → PNG). Se non è deterministico, la preview e il PNG esportato divergono silenziosamente.

## Decisione

`<MapStory>` è una **funzione pura**: `(template, activity, customizations) → JSX`. Vietati:
- Hook di stato (`useState`, `useReducer`, `useRef` con side effect)
- Fetch interni (`useEffect`, server components con fetch, SWR)
- Input impliciti: `Date.now()`, `Math.random()`, `process.env.*`, `window.*`
- Side effect di qualsiasi tipo

Il determinismo è garantito da snapshot test in CI, non rimovibili.

## Razionale

- Stesso input → stesso PNG byte-per-byte → cache idempotente possibile (future versioni)
- Preview nell'editor è identica all'export → "what you see is what you get"
- Il render worker (Playwright) è stateless: può girare su qualsiasi box senza coordination
- I test di snapshot sono la rete di sicurezza: qualsiasi violazione accidentale della purezza viene catturata prima del merge

## Conseguenze

- Qualsiasi PR che tocca `MapStory` o i layer deve far passare i purity test
- `--update-snapshots` richiede review manuale del diff visivo
- La formattazione dei dati (distanza, tempo, locale) avviene dentro il componente, ma usando valori da props — non da `Intl` con locale di sistema (usare `'it-IT'` hardcoded)
