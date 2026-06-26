---
name: mobile-plan-decisions
description: Refined mobile UX plan for rejs — chosen navigation model (tabs not sheet), breakpoints, what shipped vs deferred
metadata:
  type: project
---

Mobile UX first pass shipped on branch `feat/mobile-ux` (PR against main, 2026-06-21).

**Navigation model chosen: full-bleed TABBED layout (Map / Plan / Edit), NOT a
draggable multi-detent bottom sheet** (the original M1 suggestion).
**Why:** a custom gesture-driven 3-detent sheet is high surface area and easy to
get wrong (Leaflet-drag vs sheet-drag conflict, scroll trapping, a11y focus). The
tab swap delivers M1's actual goal (each view full-screen, map-first default,
editor on demand) at far lower risk. Same components render per tab; only
presentation diverges. A sheet remains a possible future evolution.
**How to apply:** when extending mobile, prefer the tab structure; don't reach for
a sheet unless the tab swap proves too coarse.

Layout swap lives in `src/App.tsx`: `useMediaQuery(PHONE_QUERY)` (src/state/
use-media-query.ts, `(max-width: 640px)`) gates an early-return phone render
branch with its own Toolbar (compact), `<main class="app__mobile-view">`, and a
bottom `<nav class="app__tabs">`. All hooks run BEFORE the early return (no
conditional-hook violation). Reusable JSX (`editorPanel`, `mapView`, `geostatus`)
is extracted so desktop and phone share it.

Breakpoints (M7): desktop split kept to 768px (narrower sidebar), stacks 640–700px,
phone tabs only below 640px.

Key decisions / gotchas:
- The MAP stays mounted across tab switches (hidden full-size + out of flow via
  `.app__mobile-hidden`) so Leaflet retains pan/zoom. Do NOT hide it with 0×0 or
  display:none — Leaflet would need invalidateSize() on return. Plan/Edit panels
  are conditionally mounted (pure DSL projections, no view state to lose).
- `--app-vh` CSS var set from `visualViewport.height` (phone only) shrinks the
  layout above the soft keyboard (M3 keyboard-survival).
- Tap a timeline row → `focusHopOnMap` sets activeHopId AND jumps to Map tab (M2).
- Edit tab shows an error/warning badge from diagnostic counts.
- Compact Toolbar Save on a never-saved buffer must PROMPT (no inline name field
  exists in compact mode) — a reviewer caught this as a dead button.

Shipped: M1 (tabs), M2, M3 (keyboard-survival half), M5 (already existed), M6
(hit targets only), M7, M8 (OrientationHint), M9 (compact toolbar).
Deferred to a follow-up PR: M4 (DSL token accessory bar) + the pinned-above-
keyboard suggestion strip (M3 second half); M6 drop-pin crosshair.

Tests: src/state/use-media-query.test.ts, src/components/OrientationHint.test.tsx,
compact-mode tests in Toolbar.test.tsx, and tests/e2e/mobile.spec.ts (Playwright
forces a 390×780 touch viewport via `test.use` — no separate PW project, so
desktop specs stay desktop). Feature recording approach: the repo's
record-feature.sh uses `--config=<(...)` process substitution which FAILS in this
sandbox (pipe fd unreadable); record manually with a temp config file at repo root
(needs node_modules resolution) including baseURL + webServer + video:on.
