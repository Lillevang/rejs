---
name: friction-patterns
description: Recurring UX friction in rejs and which ideas are already logged in IDEAS.md (avoid duplicates)
metadata:
  type: project
---

Friction patterns observed in rejs (see [[app-overview]]).

**Why:** Track what's been flagged so future reviews don't re-log duplicates and can build on prior reasoning.

**How to apply:** Before appending to IDEAS.md, check this list and the existing entries.

Already in IDEAS.md (pre-existing, by the team): Share link (URL-encoded preferred), Bookkeeping actuals-vs-budget.

Ideas I (ux-simplicity-advocate) added on 2026-06-20:

- Editor-required-only-for-everything: no GUI escape hatch — every edit means typing DSL. Flagged inline pin-drag / quick-add as the simplest mitigations.
- Save flow friction: Save needs a typed name even to re-save the current plan (no rename/overwrite of the loaded plan, no dirty indicator).
- Geocoding ambiguity: a name like "Venice" or "Springfield" silently resolves to one guess with no disambiguation/confirmation.
- Export friction: no way to get the plan out (print/PDF/share/ICS) — localStorage is a dead-end for a _travel_ artifact you want on your phone.
- First-run clarity: example loads but the DSL-as-UI model isn't explained; new users may not realize they edit text.

Recurring theme: the DSL is powerful and keeps the app simple to _build_, but it pushes authoring toil onto the user. Best simplicity wins here are small GUI affordances that write DSL for the user (pin drag, quick-add, click-to-disambiguate) rather than new DSL syntax.

Mobile UX (added a dedicated "Mobile UX" section to IDEAS.md, entries M1–M9, on 2026-06-20):

- Current mobile state is ONE breakpoint: `@media (max-width: 860px)` in src/styles.css stacks sidebar above main at 45% height. No phone-specific handling, no tablet/phone distinction. The resize divider is the only touch-aware bit (`touch-action: none`, 44px grip).
- Editor autocomplete (Editor.tsx) is caret-pixel-positioned via a mirror element and navigated only by hardware keys (Arrow/Tab/Enter/Esc) — all absent on a soft keyboard. `editor-suggest.ts:getCompletionContext` is the reusable hook for any assisted-editing affordance (token bar, chips).
- Toolbar.tsx has ~9 controls with flex-wrap; wraps into a tall stack on narrow screens. Inline "Save as…" text field is a poor phone affordance.
- Map markers are below touch target size (activity dots 12px, drive stops 16px); hover tooltips have no touch equivalent. `activeHopId`/`onHover` wiring can be bound to tap.
- Highest-priority mobile recommendation: M1 (map-first full-bleed + bottom sheet, editor on demand) + M2 (bless read-mostly view mode as the mobile default). The trap to avoid: turning rejs into a form-based editor (would change what the app IS — same risk class as #8). Every mobile affordance must still write valid DSL.
- Mobile ideas explicitly depend on / extend existing ideas #3 (disambiguation), #4 (drag-to-place), #5 (quick-add hop), #6 (first-run hint).
