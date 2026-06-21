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

## M1. A real phone layout: full-bleed map + bottom sheet, editor on demand

**Type:** Friction removal · **Effort:** Medium
**Area:** src/App.tsx, src/styles.css (new mobile breakpoint), src/components/\*

**Problem:** The current 860px breakpoint just reflows the desktop layout: editor
at 45% on top, everything else crammed below. On a phone you get a tiny editor, a
~140px map, a squished timeline, and the summary cards — all at once, none usable.
Stacking four panels vertically on a 375px-wide screen is the worst of every view.

**Suggestion:** At a true phone breakpoint (~640px), stop reflowing and switch to a
**map-first layout**: the Leaflet map goes full-bleed as the primary surface, with a
draggable **bottom sheet** for the trip detail. The sheet has two-or-three detents
(peek = Summary line; half = Timeline; full = Editor + Diagnostics). The map is the
thing people actually want on a phone (where am I going, in what order); the editor
is summoned only when they choose to edit. This is one layout swap keyed off the
breakpoint, not a rewrite — the same components render inside the sheet. Reuse the
existing resize-divider plumbing (`use-resizable-height`, which already sets
`touch-action: none`) for the sheet drag.

**Impact:** Gives each view the full width when it's in focus instead of a quarter
of a cramped column. Surfaces the most-useful artifact (map) first and hides the
least mobile-friendly one (editor) until asked. One primary layout decision that
the rest of the mobile ideas hang off.

## M2. Read-mostly mobile: make a desktop-authored plan a joy to _view_ on a phone

**Type:** Simplification · **Effort:** Low
**Area:** src/components/{MapView,Timeline,Summary}.tsx, src/styles.css

**Problem:** Most real usage on a phone is _consuming_ a plan you wrote on a
laptop, while traveling — not authoring. But the design treats mobile as "the same
editor, smaller," so the viewing experience is collateral damage. Trying to make
the textarea great on a phone is solving the rare case at the expense of the common
one.

**Suggestion:** Explicitly bless **view mode** as the mobile default (pairs with
M1: sheet opens at the Summary/Timeline detent, editor tucked away). Make the
read-only views finger-friendly: tap a timeline row or summary item to recenter the
map on that hop (reusing the existing `activeHopId`/`onHover` wiring — just bind it
to tap as well as hover); larger tap targets on timeline rows; horizontal scroll
for the Gantt instead of crushing it. No new data model — this is CSS plus binding
tap to the hover handlers that already exist. Authoring still works (M3), it's just
not the thing the phone optimizes for.

**Impact:** Turns the phone from "a bad place to edit" into "a great place to carry
your trip" — the actual mobile job. Cheapest high-value win because it reuses
existing state and only touches presentation.

## M3. Keep the textarea, but make it survive the soft keyboard + tappable autocomplete

**Type:** Friction removal · **Effort:** Low–Medium
**Area:** src/components/Editor.tsx, src/styles.css

**Problem:** If a user _does_ edit on mobile, two things break. (1) When the soft
keyboard opens it covers the bottom ~half of the screen; with the editor in a
fixed-height flex box, the line you're typing can end up behind the keyboard with
no way to scroll it into view. (2) The autocomplete list is positioned and
navigated assuming a hardware keyboard — Arrow/Tab/Enter/Esc do nothing on a soft
keyboard, so the only way to accept a suggestion is to tap it, and the caret-pixel
positioning can place the list off-screen or under the keyboard.

**Suggestion:** Don't replace the textarea (it _is_ the app) — make it behave:
(a) use the `visualViewport` API / `env(safe-area-inset-*)` so the editing area
shrinks to the space above the keyboard and the active line stays visible; (b) when
on a touch/coarse-pointer device, render the suggestion list as a compact strip
**pinned just above the keyboard** (an input-accessory bar) instead of caret-anchored,
so it's always reachable and tap-accepts cleanly. Detect with
`@media (pointer: coarse)` / matchMedia rather than UA sniffing.

**Impact:** Makes the existing editor genuinely usable on a phone for small edits
(fix a name, bump a budget) without inventing a parallel editing UI. Recovers the
autocomplete — already the best assist we have — for soft-keyboard users.

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

## M5. Quick-add a hop, mobile-first (depends on / extends #5)

**Type:** Friction removal · **Effort:** Low
**Area:** src/components/Timeline.tsx or the bottom sheet, src/dsl/\* (appends a hop)

**Problem:** The blank-page "how do I start a hop" moment (#5) is even harder on a
phone, where typing `hop Name:` from memory is the worst-case input. Without an
escape hatch, mobile authoring stalls at the first hop.

**Suggestion:** Surface the existing **"+ Add hop"** idea (#5) prominently in the
mobile view (e.g. a button at the end of the Timeline / in the sheet). It appends a
well-formed `hop New stop:` / `stay: 2d` block and focuses that line for renaming —
the user types only the place name, everything structural is generated. On mobile
this is the primary way to grow a plan; combined with M4's chips and inline
pin-placement (M6), most authoring needs no raw-syntax typing at all.

**Impact:** Removes the hardest part of mobile authoring (producing valid structure
by hand). Reuses #5 with zero new concepts — just makes it the default mobile add
path.

## M6. Touch-friendly map: bigger targets, tap-to-place, no scroll/pan fight

**Type:** Friction removal · **Effort:** Medium · **Depends on:** #3, #4
**Area:** src/components/MapView.tsx, src/styles.css

**Problem:** Three touch problems. (1) Markers are small — activity dots are 12px,
drive stops 16px, well under the ~44px touch target — so tapping the right pin is a
lottery and tooltips meant for hover have no touch equivalent. (2) With the map
embedded in a scrolling column (today's layout), one-finger drag is ambiguous: pan
the map or scroll the page? (3) The future drag-to-place (#4) and disambiguation
(#3) assume mouse precision a finger doesn't have.

**Suggestion:** (1) On coarse pointers, enlarge hit areas (transparent padding
around small markers) and replace hover tooltips with **tap-to-select** that shows
the detail in the bottom sheet (reuses `activeHopId`). (2) M1's full-bleed map
removes the scroll/pan conflict for the primary map; where the map is inside the
sheet, use Leaflet's `tap`/`dragging` config and let the sheet own vertical drags.
(3) For touch disambiguation (#3), prefer the **inline chooser list** ("Venice,
Italy / Venice, FL") over precise map-tapping; for placement (#4), offer a
**"drop pin at map center"** crosshair affordance instead of requiring a precise
long-press-drag — the user pans the map under a fixed center reticle and taps to
set, which writes `coords:` exactly like #4.

**Impact:** Makes the most mobile-native view actually work with a thumb. Reframes
#3/#4 so their touch story is "pan-and-tap," which fingers do well, instead of
"precise drag," which they don't.

## M7. Tablet: keep the desktop split — it's a different device

**Type:** Simplification · **Effort:** Low
**Area:** src/styles.css (breakpoint boundaries)

**Problem:** Tablet and phone get lumped together by the single 860px breakpoint,
but they're different: a tablet (especially landscape, often with a keyboard) has
the width to run the real side-by-side editor+map layout, while a phone does not.
Forcing the phone's map-first sheet onto a tablet would _remove_ a layout the
tablet can comfortably show.

**Suggestion:** Use **two** boundaries, not one: keep the desktop side-by-side
layout down to ~768px (tablet/landscape), and only switch to the phone map-first
sheet (M1) below ~640px. Tablet ≠ phone: tablet keeps the split sidebar (perhaps
narrower), phone gets the sheet. This is just choosing breakpoint values
deliberately rather than adding UI. Note: on a tablet with no hardware keyboard the
soft-keyboard fixes (M3) and token bar (M4) still apply when the editor is focused.

**Impact:** Tablet users keep the productive split view instead of being demoted to
the phone experience; phone users still get the layout built for them. Costs only
breakpoint tuning.

## M8. First-run + orientation on mobile (extends #6)

**Type:** Friction removal · **Effort:** Low
**Area:** src/App.tsx, src/components/Editor.tsx, src/styles.css

**Problem:** The unusual text-as-UI model (#6) is even less obvious on a phone,
where the editor may be hidden behind the bottom sheet (M1) — a new mobile user
might never realize they can edit at all, or how. Separately, the Gantt timeline
and side-by-side intent read far better in landscape, but nothing nudges rotation.

**Suggestion:** (a) Reuse #6's one-line dismissible hint, mobile-worded and placed
on the sheet's editor detent: "Tap to edit your trip as text — the map updates
live. New here? Open the DSL guide." (b) A _gentle, dismissible_ one-time hint in
portrait when a timeline is present: "Rotate for a wider timeline" — never a
blocking orientation-lock. Both persist dismissal in localStorage like #6. No tour,
no modal.

**Impact:** Closes the discoverability gap that M1 could otherwise open (editor
hidden by default), and points users to the layout that suits the timeline — with
one sentence each, shown once.

## M9. Mobile toolbar: collapse 9 controls into an overflow menu

**Type:** Simplification · **Effort:** Low
**Area:** src/components/Toolbar.tsx, src/styles.css

**Problem:** The toolbar now holds ~9 controls (Save, loaded-name + dirty hint,
Save-as input + button, Saved-plans select + Load + Delete, Copy share link, DSL
guide, Load example). It's `flex-wrap: wrap`, so on a narrow viewport it wraps into
a tall stack that eats scarce vertical space before the user sees any of their trip
— and the inline "Save as…" text field is a poor phone affordance.

**Suggestion:** On mobile keep only the **two high-frequency actions inline** — Save
(with the dirty dot) and a single overflow "⋯" / menu button — and move Save as…,
Saved plans (Load/Delete), Copy share link, DSL guide, and Load example into that
menu (a sheet or simple dropdown). "Save as…" becomes a menu item that prompts for
a name on tap rather than an always-present text field. This is a presentational
regroup of existing handlers, no behavior change.

**Impact:** Reclaims vertical space for the trip, removes the wrapped-toolbar clutter,
and turns infrequent actions into a tidy menu instead of a wall of buttons. Low
effort, pure layout.

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
