# Architecture

rejs is a single-page app with **no backend**: the DSL text a user types is the
single source of truth, and everything — parsing, resolving, geocoding,
rendering, persistence — happens in the browser.

**Stack:** React 18 + TypeScript, bundled by Vite 5. Unit tests: Vitest (+
Testing Library, jsdom). End-to-end: Playwright.

## The pipeline

The data flow is one-directional and re-runs on every keystroke (both steps are
pure and cheap, so there is no debounce):

```
DSL text ──parse──> AST ──resolve──> resolved plan (+ diagnostics) ──> render
                                                                        ├─ Summary
                                                                        ├─ MapView (Leaflet)
                                                                        └─ Timeline
```

- **`parse`** (`src/dsl/parse.ts`) — text → AST, plus syntax diagnostics.
- **`resolve`** (`src/dsl/resolve.ts`) — AST → a resolved plan (dates chained,
  budgets summed per currency, legs derived) plus date-sanity diagnostics.
- **Render** — `Summary`, `MapView`, and `Timeline` are pure views of the
  resolved plan, so all three stay in sync automatically.

### Edits round-trip through the text

Every feature that "edits the plan" — dragging a hop pin, clicking the map to
place the active hop, quick-add, picking a geocode disambiguation candidate —
does so by **editing the DSL text** (`src/dsl/edit.ts`) and letting the pipeline
re-render. The text never goes stale, because nothing else is authoritative.

## Module map (`src/`)

| Dir                    | Responsibility                                                                                                                                                        |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `dsl/`                 | The language: `parse.ts` (text → AST), `resolve.ts` (AST → resolved plan + diagnostics), `edit.ts` (programmatic DSL edits), `types.ts`. **The core — start here.**   |
| `geocode/`             | `nominatim.ts` (place name → coordinates) and `ambiguity.ts` (detect genuinely competing matches for the disambiguation chooser).                                     |
| `state/`               | `store.ts` (localStorage persistence), `use-geocoder.ts` (dedupe/cache lookups), and other hooks (media query, resizable height).                                     |
| `components/`          | UI: `Editor.tsx` (+ `editor-suggest.ts` autocomplete), `MapView.tsx`, `Timeline.tsx`, `Summary.tsx`, `Diagnostics.tsx`, `Toolbar.tsx`, `HelpModal.tsx`, hints.        |
| `lib/`                 | Pure helpers: dates, colors, formatting, duration, share links (`share.ts`/`short-link.ts`/`share-link.ts`), the DSL reference, `.ics` export, the seed example plan. |
| `App.tsx` / `main.tsx` | Composition root.                                                                                                                                                     |

The auto-generated tree and public API surface live in
[`.agent/CODEBASE.md`](../.agent/CODEBASE.md).

## Geocoding

Place names resolve to coordinates via the public
[Nominatim](https://nominatim.openstreetmap.org/) API. Lookups are **deduped and
cached client-side** (`use-geocoder.ts`) so repeated names cost one request. When
a name is genuinely ambiguous (e.g. "Venice"), rejs surfaces an inline chooser
rather than silently guessing; picking a candidate writes `coords:` back into the
DSL. A hop with an explicit `coords:` is never geocoded.

## State & persistence

All state is local. `localStorage` holds:

- **one autosaved "current" buffer** — the working plan, saved (debounced) on
  every edit so a reload restores your journey, and
- **named save slots** — "Save as…" creates a slot; "Save" overwrites the loaded
  slot in place; an "• unsaved changes" hint shows when the buffer diverges.

A `#plan=…` [share link](./share-links.md) takes precedence over the autosaved
buffer on first load.

## Testing

- **Unit tests** live next to the code they cover (`foo.ts` + `foo.test.ts`),
  run with `npm test` (Vitest). The DSL guide snippets are parsed by a test so
  the reference can't drift from the parser.
- **End-to-end specs** live in `tests/e2e/`, run with `npm run e2e` (Playwright).

Both run as part of the done-gate (`./.agent/scripts/check.sh`).
