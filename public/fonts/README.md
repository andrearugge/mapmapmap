# Fonts

Self-hosted fonts used in Art components. All fonts must be under SIL Open Font License (OFL).

## Requirements

- Fonts here are served statically by Next.js from `/fonts/`.
- The same font files MUST be installed in the Playwright render container (Plan 03).
- Divergence between browser fonts and Playwright fonts causes the exported PNG to differ from the preview (silent bug).

## Adding a font

1. Verify the font is OFL-licensed.
2. Place the .woff2 file here.
3. Add `@font-face` to `src/app/globals.css`.
4. Update Plan 03 to install the font in the Playwright container.
5. Run the font-parity test (Plan 03, Task 3) to verify consistency.

## Current fonts

| File | Family | License |
|------|--------|---------|
| (none yet) | system-ui used for smoke Art | — |
