---
name: layout-responsive
description: rejs current layout composition, the single 860px breakpoint, and responsive-fragile spots to watch on mobile
metadata:
  type: project
---

Current desktop layout (src/App.tsx + src/styles.css):

- `.app` = column flex, `height: 100vh; overflow: hidden`. Children: Toolbar, `.app__body`, HelpModal.
- `.app__body` = row flex. `.app__sidebar` (width 400px, min 320px) holds Editor + Diagnostics. `.app__main` (flex:1) holds Summary, MapView (`.map` flex:1), geostatus, resize divider, `.app__timeline` (inline height from `useResizableHeight`).
- The ONLY responsive rule before mobile work: `@media (max-width: 860px)` stacks body to column, sidebar `width:100%; height:45%`. This crams editor + map + timeline + summary into a phone — the problem M1 targets.

Responsive-fragile / hardcoded-desktop spots:

- Timeline rows use `grid-template-columns: 132px 1fr 84px` and axis `padding-left: 140px` — fixed label column, tight on phones.
- `.map { min-height: 140px }` — collapses badly when stacked.
- `.summary` is a row flex with `min-width: 96px` cards + budget pushed right via `margin-left:auto` — wraps awkwardly narrow.
- Toolbar is `flex-wrap: wrap` with ~9 controls incl. an always-present "Save as…" text input — wraps into a tall stack on narrow viewports (M9).
- There is already a `@media print` block (hides chrome, shows summary+timeline). Keep mobile rules from clashing with it.

Reusable plumbing:

- `useResizableHeight` (src/state/use-resizable-height.ts) already uses Pointer Events + `setPointerCapture` and the divider has `touch-action: none` — works for a bottom-sheet drag handle (M1).
- Per-hop color thread via `colorForIndex` (src/lib/colors.ts) — pin/leg/timeline share it.
- `activeHopId` + `onHover` wiring is shared across MapView and Timeline — bind tap to it for mobile (M2/M6).
