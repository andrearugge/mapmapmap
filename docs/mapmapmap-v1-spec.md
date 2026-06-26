# Mapmapmap — Specifica v1

> **Natura del documento.** Questa è una *specifica*, non un piano di sviluppo. L'obiettivo è fornire all'agente di planning (Claude Code + Superpowers) decisioni chiuse, contratti dati e vincoli interpretabili in modo non ambiguo. La sequenza di task, le stime e l'ordine di build sono **fuori dallo scopo di questo documento**: vanno derivati a valle.
>
> **Come leggere il documento.** È diviso in due piani distinti:
> - **Decisioni vincolanti** — scelte chiuse. Non vanno reinterpretate, ridiscusse o "migliorate". Sono invarianti.
> - **Spazio implementativo** — aree dove l'agente è libero di ragionare (struttura file, naming, ordine di build, dettagli di libreria).
>
> Tutto ciò che non è marcato come vincolante è implementativo.

---

## 1. Contesto e obiettivo

Mapmapmap è una web app che genera un'immagine in formato Instagram Story (1080×1920) a partire dai dati di un'attività sportiva dell'utente (corsa/giro), per essere condivisa sui social.

**Obiettivo della v1:** validare la domanda — agli utenti piace creare e condividere queste immagini? — con il minimo necessario, senza vincoli di App Store. Ogni scelta privilegia velocità di validazione e assenza di riscritture future.

L'utente finale è su **mobile**. L'admin è su desktop.

---

## 2. Scope v1 / Fuori scope v1

### Dentro la v1
- Landing page con CTA unica: "Connect with Strava".
- Login solo via Strava OAuth (unico entry point dati).
- Area privata utente (mobile-first): lista ultime attività con GPS, selezione template (Art), personalizzazione, export.
- Export **PNG trasparente** 1080×1920.
- Catalogo Art **hardcoded** (Art = codice, non dati editabili da UI).
- Mini-admin (desktop): gestione utenti (modifica/cancellazione), creazione gruppi, dashboard analytics minimale, sezione Art in **sola lettura**.
- Modello di **entitlement** (quali Art sono disponibili a quali utenti/gruppi) **modellato a dato fin da subito**, anche se l'admin lo gestisce in sola lettura.

### Fuori dalla v1 (da non costruire "per scrupolo")
- Export **video** ed effetti animati. (Decisione chiusa, vedi §9.)
- Background **video**.
- Layer di **overlay** in modalità export trasparente. (Vedi §6.4.)
- Profilo utente CRUD completo (username univoco, upload avatar, campo Instagram come sottosistema): in v1 nome e avatar derivano da Strava; l'handle è eventualmente editabile inline. Niente pagina profilo.
- Gestione Art editabile da admin (creazione/modifica via UI).
- Autoscaling, load balancer, multi-box.
- Fonti dati alternative a Strava in produzione (il fallback GPX è previsto a modello — §5.4 — ma non è obiettivo di onboarding v1).

---

## 3. Decisioni vincolanti — Architettura e stack

- **Hosting consolidato su Hetzner**, gestito tramite il pannello **ploi.io** (non "Ploi Cloud"). Una sola box per la v1 (CPX21/CPX31).
- **Cloudflare** davanti: DNS, CDN (cache edge dei contenuti statici), SSL, mascheramento origin.
- **Cloudflare R2** per gli asset (background delle Art, PNG esportati se persistiti). S3-compatibile, no egress fee.
- **Next.js (App Router) + TypeScript**, build in **output standalone**. Una sola app contiene: landing, area utente, `/admin` (route role-gated), endpoint di export.
- **Next.js "vanilla"**: vietate le feature Vercel-only (Vercel KV/Blob, trucchi legati all'edge runtime proprietario). Motivo: il target di deploy deve restare a binding tardivo — la stessa codebase deve poter girare anche altrove senza riscrittura.
- **PostgreSQL co-locato sulla stessa box** del processo Next.js. Connessione via pool normale (max sano, es. 10–20), nessun PgBouncer. Motivo: processo Node persistente → niente connection storm serverless.
- **Tailwind + shadcn/ui** per l'admin; **TanStack Table** per le tabelle.
- **Auth.js (NextAuth)** con provider Strava custom; token Strava cifrati a riposo.
- **Drizzle** (ORM) + **Zod** (validazione).
- **Backup automatici** del Postgres su R2 (gestiti da Ploi).
- Render worker gestito come **queue worker** (Supervisor/PM2 via Ploi). Vedi §7.

**Razionale di scaling (vincolante come principio, non come implementazione):** il collo di bottiglia sotto picco è **Strava** (§5), non il server. Il picco statico è assorbito da Cloudflare in edge; il carico dinamico è strozzato a monte dai rate limit Strava. Quindi il web tier non necessita di autoscaling. Lo scaling del render è **orizzontale e stateless** (aggiungere una box worker), reso possibile dall'isolamento del render dietro interfaccia (§7) — è un'operazione, mai una riscrittura.

---

## 4. Decisioni vincolanti — L'invariante di purezza

Esiste un unico componente di rendering, `<MapStory>`, che è una **funzione pura**:

```
(template, activity, customizations) → JSX
```

Questo componente è usato **identico** in tre contesti:
1. Strumento di authoring delle Art (preview di sviluppo).
2. Editor utente (preview live, mobile).
3. Export server (screenshot → PNG).

**Regole non negoziabili:**
- Nessun hook di stato, nessun fetch interno, nessun side effect.
- Nessun input implicito: vietati `Date.now()`, `Math.random()`, letture di ambiente. Tutto entra dalle props.
- Deterministico: stesso input → stesso output byte-identico. È il prerequisito della cache idempotente (§7).
- I font usati devono essere disponibili in **tutti e tre** i contesti di render (stesso set), altrimenti il testo diverge.

Violare la purezza rompe i tre contesti insieme. È l'invariante centrale del progetto.

---

## 5. Decisioni vincolanti — Strava

### 5.1 Scope e dati
- Scope OAuth: **`activity:read`** soltanto. Vietato `activity:read_all`. Motivo: evitare dati privati e non bypassare le privacy zone (rischio esposizione della home dell'utente sull'immagine pubblica).
- Per la route si usa la **polyline già tagliata dalle privacy zone** (summary polyline), decodificata e normalizzata nel data layer.
- Token Strava: scadenza 6 ore → refresh proattivo del refresh token (cifrato).

### 5.2 Rate limit (per-applicazione, condivisi tra tutti gli utenti)
- Default: 200 richieste/15 min, 2.000/giorno complessive; **100/15 min, 1.000/giorno per le letture**.
- Implicazione vincolante sul design: **minimizzare le letture per utente**. Fetch pigro (attività caricate solo all'apertura del picker, non al login), cache in DB di attività e polyline normalizzata (scaricate una volta, mai ri-fetch a ogni modifica), paginazione (ultime attività, non lo storico).

### 5.3 Termini d'uso (vincoli di prodotto)
- "Powered by Strava" presente e **non rimovibile** sull'artefatto esportato (§6.5).
- Il design dell'app non deve replicare il look & feel di Strava.
- Vietato qualunque processing aggregato dei dati attività (analytics/insight sui dati Strava). Le analytics admin (§8) riguardano **metadati dell'app** — utenti, mappe generate — non dati di attività: questa distinzione è vincolante.

### 5.4 Fallback GPX
- Il modello dati delle attività (§6.1) è **sorgente-agnostico**: stessa shape da Strava o da upload GPX. Il fallback non è obiettivo di onboarding v1, ma il contratto dati deve renderlo possibile senza modifiche strutturali.

---

## 6. Decisioni vincolanti — Modello dati e contratti

### 6.1 ActivityData (normalizzato, sorgente-agnostico)

```ts
type ActivityData = {
  id: string;
  type: string;                 // 'run' | 'ride' | 'walk' | 'hike' | ...
  name: string;
  date: string;                 // ISO 8601
  stats: {
    distance_m: number;
    movingTime_s: number;
    elapsedTime_s: number;
    elevationGain_m: number;
    avgSpeed_mps: number;
  };
  route: {
    points: [number, number][]; // normalizzati [0..1]², aspect preservato, fit-centered
    hasGps: boolean;            // false → attività indoor: l'Art mostra il fallback previsto
  };
  athlete: { name: string; avatarUrl?: string; handle?: string };
};
```

- I valori sono in **SI grezzo**. La formattazione (sistema metrico, locale IT, formato passo/tempo) avviene **dentro il componente**.
- La **normalizzazione della route** avviene nel data layer (è la polyline cachata). Il componente riceve già `[0..1]²` e la mappa nel box dello slot.

### 6.2 Template / scene graph (definito dal designer, statico)

```ts
type Anchor = `${'top'|'middle'|'bottom'}-${'left'|'center'|'right'}`;
type Box = { x: number; y: number; w: number; h: number }; // unità viewBox, frame 1080×1920
type Placement = 'frame' | 'cluster'; // frame = fisso; cluster = si muove col wrapper

type StyleToken = 'primary' | 'accent';
type RouteStyle = { stroke: StyleToken; width: number; dash: 'solid'|'dashed'|'dotted'; glow?: boolean };
type TextStyle  = { font: string; size: number; color: StyleToken; weight?: number };

type LayerNode =
  | { kind: 'background'; placement: 'frame' }   // riempito da customizations.background
  | { kind: 'overlay'; placement: 'frame' }      // presente SOLO se background.type === 'image'
  | { kind: 'route'; placement: Placement; box: Box; style: RouteStyle }
  | { kind: 'stat'; placement: Placement; bind: keyof ActivityData['stats'] | 'name' | 'date'; box: Box; style: TextStyle; format?: string }
  | { kind: 'text'; placement: Placement; value: string; box: Box; style: TextStyle }
  | { kind: 'badge'; placement: Placement; box: Box; render: string } // id di un blocco grafico dell'Art
  | { kind: 'attribution'; placement: 'frame'; anchor: Anchor };      // <StravaAttribution/>, non rimovibile

type Template = {
  id: string;
  name: string;
  size: { w: 1080; h: 1920 };
  layers: LayerNode[];          // ordine = z-index
  allowedAnchors: Anchor[];     // sottoinsieme delle 9 posizioni ammesse per il cluster (§6.3)
  defaultAnchor: Anchor;
  customizationSchema: unknown; // ZodSchema: definisce controlli disponibili, default, valori ammessi
};
```

- `customizationSchema` è **doppio-uso**: alimenta sia i controlli dello strumento di authoring sia la UI dell'editor utente. Ogni Art espone solo le leve che ha senso esporre.
- I token di stile (`primary`/`accent`) sono **risolti a runtime** dalle `customizations`: lo stesso set di leve pilota tutte le Art in modo uniforme. **Decisione chiusa:** i token sono limitati e fissi (no design system esteso/nominato).

### 6.3 Posizionamento Art (wrapper sul cluster)

- I layer marcati `placement: 'cluster'` sono composti in un **wrapper allineabile**, posizionato nel frame in base a `customizations.artPosition`.
- I layer `placement: 'frame'` (background, overlay, attribution) sono **fissi** e non si muovono col wrapper.
- Il **layout interno** al cluster è design fisso del template. Il wrapper **riposiziona, non ricompone.**
- Quali layer stiano nel cluster e quali a frame è **scelta compositiva del designer** (es. una route full-bleed può essere `frame`; stats + badge nel `cluster`).
- Ogni Art dichiara via `allowedAnchors` **quali** delle 9 posizioni ammette: non è obbligata a reggere tutte e nove.
- Il padding del wrapper deve incorporare le **safe area di Instagram Story**, così nessuna posizione finisce sotto la UI nativa di IG. Valori (canvas 1080×1920, spec 2026):
  - **Top: 250px** riservati (profilo, username, progress bar).
  - **Bottom: 250px** riservati (barra risposta, send, area sticker/link).
  - Banda centrale sicura: **1080×1420** (tra il marco verticale 250px e 1670px).
  - Margine laterale consigliato: ~64px per igiene visiva (non imposto dalla UI).
  - Nota GTM: gli influencer useranno verosimilmente il **link sticker**, che vive nella fascia bassa. Le Art con anchor `bottom-*` non devono collocare contenuto critico nell'estremo inferiore. (Decisione aperta: vedi §11.3 — riservare 250px o di più al fondo.)

### 6.4 Customizations (leve utente)

```ts
type Customizations = {
  primary: string;   // hex
  accent: string;    // hex
  background:
    | { type: 'transparent' }                                              // export trasparente: NESSUN overlay
    | { type: 'image'; assetUrl: string;
        overlay: { enabled: boolean; color: string; opacity: number } };   // overlay enabled default = false
  artPosition: Anchor; // ∈ template.allowedAnchors
};
```

**Regola overlay/background (decisione chiusa):**
- `background.type === 'transparent'` → il layer overlay **non esiste** e non viene esportato. Il controllo overlay non compare nell'editor. La leggibilità sopra il video la gestisce l'utente col proprio materiale.
- `background.type === 'image'` → overlay disponibile, **default spento** (`enabled: false`).
- Conseguenza: lo "scrim" come concetto separato è **eliminato** (non risolto: rimosso). L'overlay è legato esclusivamente al background immagine.

### 6.5 Attribution
- `<StravaAttribution />` è un layer `frame`, sempre presente, **non rimovibile**, incluso in `<MapStory>` così da viaggiare nel PNG esportato.

---

## 7. Decisioni vincolanti — Render

- L'export è uno **screenshot server-side** dello stesso componente `<MapStory>` (purezza, §4), a 1080×1920, con `omitBackground: true` → **PNG trasparente**. Motore: **Playwright/Chromium**.
- Il render è **isolato dietro un'interfaccia**:

```ts
interface Renderer {
  render(input: { template: Template; activity: ActivityData; customizations: Customizations }):
    Promise<{ png: Buffer; cacheKey: string }>;
}
```

  Motivo: *dove* gira il render (stessa box, box worker dedicata, servizio esterno) è una scelta di deploy a binding tardivo, non architetturale.
- **Coda** davanti al render con limite di concorrenza = numero di vCPU. Sotto picco la coda **degrada con attesa, non con errori**. (Libreria: spazio implementativo; pg-boss sul Postgres esistente è un'opzione naturale.)
- **Cache idempotente**: `cacheKey` = hash deterministico degli input. Stesso input → PNG servito da cache (R2). Abilitato dalla purezza/determinismo.
- Il render server-side è anche ciò che garantisce risultato uniforme indipendentemente dal browser del telefono dell'utente.

---

## 8. Decisioni vincolanti — Admin e analytics

- `/admin` è una route **role-gated** nella stessa app (non un'app separata). Accesso admin: athlete ID flaggato `role: admin` in DB.
- Funzioni v1: utenti (modifica/cancellazione), gruppi, dashboard analytics minimale, Art in **sola lettura**.
- Analytics su **metadati app** (es. utenti attivi, mappe generate, export) — **mai** su dati attività Strava (§5.3). Definizione di "utente attivo": §11.

---

## 9. Decisioni vincolanti — UX utente

- **Mobile-first** progettato sul formato, non adattato: canvas 9:16 protagonista scalato al viewport, controlli in bottom sheet, target touch ampi.
- Flow: landing → "Connect with Strava" → selezione attività (solo con GPS) → scelta template → personalizzazione con preview live → export → condivisione via **Web Share API** (`navigator.share` con file) per inviare il PNG direttamente verso IG dove supportato.
- Attività **senza GPS**: escluse dal picker o gestite con stato vuoto; non sono renderizzabili come route.

---

## 10. Decisioni vincolanti — Workflow di authoring delle Art

- Strumento locale: **Storybook** (o Ladle). Cornice 9:16 / 1080×1920 preimpostata; controlli interattivi mappati 1:1 sul `customizationSchema` dell'Art.
- **Una Art = un file.** Nel file si definiscono struttura e stile (cosa va dove, come appare); **non** i valori dei token (quelli sono leve utente).
- Preview live via HMR al salvataggio.
- Sviluppo contro **fixtures realistiche**: almeno una route lunga/tortuosa, una corta cittadina, una lineare, una senza GPS. Servono a stressare i bordi.
- "Rendere disponibile" un'Art in v1 = registrarla in un **elenco** (l'Art esiste / è proposta in app). Nessun DB delle Art, nessuna pubblicazione: vive col deploy.
- L'entitlement (Art riservata a gruppo/utente) è modellato a dato (`template ↔ gruppo`, `template ↔ utente`) ma in v1 gestito in sola lettura.

---

## 11. Questioni aperte / prerequisiti (da risolvere)

Non sono decisioni mancanti del modello, ma azioni e dettagli da chiudere prima o durante il build:

1. **Strava — uscita dal single-player mode + aumento rate limit.** Le applicazioni nuove accedono solo ai dati del proprietario finché non si richiede l'espansione. Va avviata la richiesta a Strava **prima** di qualsiasi onboarding esterno o spinta influencer, descrivendo esplicitamente il caso d'uso export-to-share (soggetto a scrutinio post-aggiornamento termini 2024). È il prerequisito a tempo più lungo e l'unico in grado di invalidare il prodotto a posteriori. **Owner: Andrea.**
2. **Conferma ToS export-to-share.** Ottenere conferma scritta da Strava che l'export di dati propri dell'utente, da lui condiviso, è conforme.
3. **Safe area Instagram Story — RISOLTA (valori in §6.3).** Top 250px, bottom 250px, banda centrale 1080×1420. Unica micro-decisione di design rimasta ad Andrea: se riservare al fondo i 250px standard oppure di più (es. ~320px) per tenere le Art lontane dal link sticker che gli influencer useranno. È un trade-off spazio-canvas vs sicurezza link sticker.
4. **Definizione di "utente attivo"** per la dashboard (es. login negli ultimi 30 gg, oppure ha generato ≥1 mappa).
5. **Licenze font — RISOLTA.** Usare font sotto **SIL Open Font License** (di fatto quasi tutto Google Fonts), installati nel container di render: embedding e rasterizzazione server-side in immagini sono permessi, anche commercialmente, senza licenze aggiuntive. Vincolo: se in futuro si vuole un typeface commerciale, verificare nel suo EULA che consenta embedding e uso server/rasterizzazione (può richiedere licenza app/web).
6. **GDPR (titolare: progetto personale no-profit di Andrea).** Privacy policy; base giuridica (consenso via Strava connect); gestione **deautorizzazione** Strava con cancellazione dati; trattamento dati di localizzazione (route GPS = dato sensibile); cookie banner. Da formalizzare prima dell'apertura a utenti esterni.

---

## 12. Ipotesi vagliate (decisioni e alternative scartate)

| Tema | Scelta | Alternative scartate | Perché |
|---|---|---|---|
| Piattaforma | App nativa | Web app | App Store = attrito e tempi; la web app valida più in fretta senza vincoli di store. |
| Export | PNG trasparente statico | Video; immagine con background pieno | Video = costo (worker, coda, licenze, UX d'attesa) non necessario a validare. Il trasparente lascia all'utente la composizione sopra il proprio video. |
| Motore render | Playwright/Chromium | Satori + resvg; Remotion; html-to-image client-side | Satori = subset CSS, niente filtri/glow → limita il design. Remotion = serviva solo per il video. Client-side = fragile su iOS Safari. Playwright = libertà CSS piena + match con la preview. |
| Render video | Escluso | Incluso | Vedi "Export". |
| Hosting | Consolidato su Hetzner + Ploi | Tutto Vercel; ibrido Vercel + box render | Sotto picco il vero soffitto è Strava, non il server; Cloudflare assorbe lo statico → l'autoscale di Vercel è in gran parte teorico per questo carico. Consolidare riduce provider, costo e attrito (i dev usano già Ploi). |
| DB | Postgres co-locato su Hetzner | Neon/Supabase (serverless) | Co-locato con processo Node persistente: latenza sub-ms, pool normale, nessun connection storm. Neon serviva solo per gestire il pooling serverless, che qui non esiste. |
| Control plane | ploi.io (pannello sul VPS) | Coolify; Ploi Cloud | I dev di Beconcept usano già ploi.io; gestisce Node/Next.js + Postgres + queue worker + SSL + backup + load balancer; EU-based. |
| Token di stile | Set fisso e limitato (primary, accent, ecc.) | Design system con token nominati | La v1 valida; il set fisso è più semplice da disegnare e da esporre. |
| Posizione Art | Wrapper allineabile sul cluster, con `allowedAnchors` per Art | Posizione fissa nel design; ogni Art deve reggere tutte le 9 posizioni | Leva utile all'utente (spostare la grafica sul proprio video) mantenendo il controllo creativo del designer. |
| Overlay | Legato al background immagine; assente nel trasparente; default spento | Overlay come leva indipendente; scrim agganciato al cluster | Semplifica eliminando il problema invece di risolverlo: nel trasparente l'overlay non ha senso. |
| Entry point dati | Solo Strava (con modello GPX-ready) | Multi-sorgente da subito | Solo-Strava in v1; il contratto dati resta sorgente-agnostico per non precludere il fallback. |
| Scope auth Strava | `activity:read` | `activity:read_all` | Evita dati privati e il bypass delle privacy zone (home dell'utente). |
