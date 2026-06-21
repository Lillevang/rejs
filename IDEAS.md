# Ideas / backlog

Deferred feature ideas — **not scheduled, not started.** Captured so we don't
lose them. Keep entries short; flesh one out when we actually pick it up. The
guiding constraint is that this app stays small and simple — prefer the option
that adds the least surface area.

Shipped ideas are archived in [`IMPLEMENTED.md`](./IMPLEMENTED.md) (with their
original rationale and as-built notes). What remains below is still open.

Ordered by priority (value per unit of added complexity), highest first.
Bookkeeping sits last by design: it's the most useful-sounding idea but the one
most likely to change what the app _is_, so it waits until the simpler wins land.

---

# Mobile UX

> **Status (2026-06-21):** A first mobile pass shipped on `feat/mobile-ux`. It
> implements the phone layout as a **full-bleed tabbed layout** (Map / Plan /
> Edit) rather than a draggable multi-detent bottom sheet — same goal (each view
> gets the full screen, map-first default, editor on demand) at much lower risk.
> Shipped: M1 (as tabs), M2, M5 (already existed; now reachable on the Plan tab),
> M6 (bigger touch hit targets + tap-a-row-to-see-it-on-the-map), M7 (tablet keeps
> the split, phone gets tabs), M8 (orientation hint), M9 (compact toolbar +
> overflow menu), and the keyboard-survival half of M3 (visualViewport sizing so
> the active line stays above the soft keyboard; the existing tap-accept
> autocomplete stays reachable). **Still open:** the pinned-above-keyboard
> suggestion strip + DSL **token accessory bar (M4)**, and the map drop-pin
> crosshair (the placement half of M6). See the trimmed entries below.

The whole app is a text-editor-as-UI: type DSL into a textarea, three views
(Summary, Leaflet map, Gantt Timeline) re-render live. That model is great with a
keyboard but breaks on a phone — small screen, a soft keyboard that eats ~half the
viewport, no precise caret, fat-finger editing of structured syntax, and three
views fighting for space. Today the **only** responsive handling is a single
`@media (max-width: 860px)` in `src/styles.css` that stacks the sidebar above the
main column at 45% height — which on a phone gives the editor a cramped scroll box
and squeezes map+timeline+summary into the other half. The autocomplete is also
caret-pixel-positioned and driven entirely by physical keys (Arrow/Tab/Enter/Esc),
none of which a soft keyboard has.

Guiding constraint, same as above: **add the least surface area**. The map is the
most mobile-native artifact; the editor is the least. The trap to avoid is turning
rejs into a form-based editor — that changes what the app _is_ (flagged like #8).
These ideas reuse the DSL-as-source-of-truth model: any GUI affordance writes
valid DSL rather than replacing it. Ordered by value per unit of complexity.

## M1. A real phone layout — SHIPPED (as tabs, not a sheet)

Shipped on `feat/mobile-ux`. Below 640px `App.tsx` (via a `useMediaQuery` hook)
swaps to a **full-bleed tabbed layout** — Map / Plan / Edit, with a bottom tab
bar — instead of the original draggable multi-detent bottom sheet. Same goal
(each view gets the full screen, map-first default, editor on demand) with far
less risk than a custom gesture-driven sheet (no Leaflet-vs-sheet drag conflicts,
no scroll trapping, simpler a11y). The same components render in each tab; only
presentation diverges. A draggable sheet remains a possible future evolution if
the tab swap proves too coarse. See IMPLEMENTED.md for the as-built notes.

## M2. Read-mostly mobile — SHIPPED

Shipped on `feat/mobile-ux`. The map is the default tab; tapping a timeline row
makes that hop active **and** jumps to the Map tab to show it (reusing the
existing `activeHopId`/`onHover` wiring, bound to tap). Touch hit targets on map
markers enlarged (see M6). Authoring still works on the Edit tab — it's just not
what the phone optimizes for.

## M3. Editor on mobile — keyboard survival SHIPPED, accessory strip OPEN

**Type:** Friction removal · **Effort:** Low–Medium
**Area:** src/components/Editor.tsx, src/App.tsx, src/styles.css

**Shipped:** The keyboard-survival half — `App.tsx` tracks `visualViewport.height`
in a `--app-vh` CSS var so the phone layout shrinks to the space _above_ the soft
keyboard, keeping the active editor line visible. The existing tap-accept
autocomplete (`onMouseDown` on each suggestion `<li>`) stays reachable.

**Still open:** The caret-pixel-anchored suggestion list can still land awkwardly
on a phone. Render it, on coarse pointers, as a compact strip **pinned just above
the keyboard** (an input-accessory bar) instead of caret-anchored, so it's always
reachable and tap-accepts cleanly. Detect with `@media (pointer: coarse)` /
matchMedia. This overlaps with M4; build the strip and the token bar together.

## M4. DSL token accessory bar above the keyboard

**Type:** Friction removal · **Effort:** Medium
**Area:** src/components/Editor.tsx, src/components/editor-suggest.ts, src/styles.css

**Problem:** Typing structured DSL (`hop`, `stay: 2d`, `@date`, `budget:`,
`coords:`) on a phone keyboard is slow and error-prone — switching to the symbol
keyboard for `:` and `@`, getting indentation right with no Tab key, fat-fingering
keywords. This is the single biggest authoring friction on mobile.

**Suggestion:** A horizontal, scrollable **token bar pinned above the soft
keyboard** offering the DSL tokens valid at the current caret context (the
completion engine in `editor-suggest.ts` already computes exactly this — reuse
`getCompletionContext`). Tapping a chip inserts the token (and its scaffold, e.g.
`stay: 2d`) at the caret. Also include the symbols the DSL needs (`:`, `@`, the
2-space indent) so the user never leaves the alpha keyboard. This is context-aware
chips over existing completion logic, not a new form — text stays the source of
truth. Overlaps with / supersedes the navigation half of M3's accessory bar; build
M3's keyboard-survival first, then layer chips on.

**Impact:** Collapses the "remember the syntax + hunt the symbol keyboard" toil
into one-tap inserts, while keeping the DSL model intact. Directly addresses
"the DSL will not work on mobile" without abandoning the DSL.

## M5. Quick-add a hop, mobile-first — SHIPPED

The "+ Add hop" affordance (`onAddHop` → `appendHop`) already existed and now
lives on the phone's Plan tab (it's part of the Timeline). It appends a
well-formed `hop New stop:` / `stay: 2d` block and selects the placeholder name
for renaming, so the user types only the place name.

## M6. Touch-friendly map — hit targets SHIPPED, drop-pin OPEN

**Type:** Friction removal · **Effort:** Medium
**Area:** src/components/MapView.tsx, src/styles.css

**Shipped:** On coarse pointers, small markers (12px activity dots, 16px drive
stops) get a transparent ~44px hit area via CSS so a thumb can land them, without
changing their visual size. The phone's full-bleed Map tab removes the
scroll-vs-pan conflict. Tapping a timeline row selects the hop and shows it on the
map (M2).

**Still open:** The **"drop pin at map center"** crosshair for placement — pan the
map under a fixed center reticle and tap to set, writing `coords:` (a thumb-friendly
alternative to the precise long-press marker drag). Pairs with the disambiguation
chooser, which is already an inline list (touch-friendly today).

## M7. Tablet vs phone breakpoints — SHIPPED

Two boundaries instead of one: the desktop split is kept down to ~768px
(narrower sidebar), stacks 640–700px, and only below 640px does `App.tsx` swap to
the phone tabbed layout. Tablet keeps the productive split; phone gets tabs.

## M8. First-run + orientation on mobile — SHIPPED

The first-run hint shows on the phone's Edit tab (it's part of the editor panel).
A gentle, one-time, dismissible portrait hint ("Rotate your phone for a wider
timeline") appears on the Plan tab when a timeline is present — never a blocking
orientation lock; dismissal persists in localStorage like the first-run hint.

## M9. Mobile toolbar — SHIPPED

On the phone, the toolbar keeps only **Save** (with a dirty dot) inline plus a
single **⋯ overflow menu** holding Save as… (prompts for a name), Saved plans
(load/delete), Copy share link, Print / Save as PDF, Download .ics, DSL guide,
and Load example. Pure presentational regroup of the existing handlers.

---

## 8. Bookkeeping while traveling (actuals vs budget) — last by design

**Type:** New feature · **Effort:** High · **Complexity risk:** highest in this list

Track what you actually spend as the trip happens, against the planned budget.
**This is the most likely idea to change the app's _job_ from "plan a trip" to
"plan and operate a trip" — so it stays at the bottom until the simpler wins
above are in.**

- Each hop already has a planned `budget:`. Add a way to log **actual** spend.
- Show planned vs actual: per hop and trip-wide (over/under, % used, burn rate vs
  days elapsed).
- **Keep actuals OUT of the DSL.** A `spent:` field bloats the plan, muddies
  share/diff, and forces budget-tracking syntax on people who just want a map.
  Prefer a separate per-trip expense store keyed to hop ids, surfaced as an
  optional second tab/panel.
- Surfacing: extend the Summary (planned/actual/Δ) and maybe color timeline bars
  by over/under.
- Ties into the share link: actuals are personal — exclude from shared plans, or
  only include in editable shares.
- **Smallest possible MVP** (if pulled forward): one trip-wide "spent so far"
  number the user types, shown next to total budget — no per-hop logging.
