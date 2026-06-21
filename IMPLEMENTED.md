# Implemented ideas

Ideas that started life in [`IDEAS.md`](./IDEAS.md) and have since shipped.
Archived here (full original entries preserved) so the rationale and the
as-built notes stay discoverable, while `IDEAS.md` keeps only what's still open.

---

## 1. Smoother save: overwrite the loaded plan + dirty indicator — DONE

**Type:** Simplification · **Effort:** Low
**Area:** src/components/Toolbar.tsx, src/App.tsx, src/state/store.ts

_Implemented._ The toolbar now tracks the currently-loaded plan name, "Save"
overwrites that slot in place (or focuses the "Save as…" input when nothing is
loaded), and a "• unsaved changes" hint shows when the buffer diverges from the
saved slot (clearing on save and on a fresh load).

**Problem:** Saving always requires typing a name, even to re-save the plan you
just loaded. There's no "update current plan," no rename, and no signal that the
working buffer diverges from the named slot. Users accumulate near-duplicate
slots or lose track of which is canonical.

**Suggestion:** Track the currently-loaded plan name. Show "Save" (updates the
loaded plan in place) plus "Save as…" (the existing name-input path). Add a small
"• unsaved changes" hint when the buffer differs from the saved slot. Defaults do
the right thing: a never-saved buffer's "Save" opens the name prompt; a loaded
plan's "Save" just overwrites.

**Impact:** Removes a typing step on the common re-save path and the "which slot
am I editing?" load. Fewer accidental duplicate plans.

## 2. Export the plan (print/PDF + calendar), not just localStorage — DONE

**Type:** New feature / Friction removal · **Effort:** Low (print CSS) / Medium (.ics)
**Area:** new src/lib/export, Toolbar

_Implemented._ A single "Export ▾" menu in the Toolbar (small accessible
dropdown; closes on outside click / Escape) offers two zero-dependency exports.
**Print / Save as PDF** calls `window.print()`; an `@media print` block in
`src/styles.css` hides the chrome (toolbar, editor, diagnostics, geostatus,
divider, menus) and lays out the Summary + Timeline cleanly on paper — the
Leaflet map is deliberately excluded (tiles/panes print unreliably and add little
on paper). **Download .ics** builds a valid RFC 5545 calendar via the pure
`planToIcs(resolved)` in `src/lib/export/ics.ts` (one all-day event per hop with
an _exclusive_ all-day `DTEND`, one all-day event per fixed `@date` activity,
CRLF endings, 75-octet line folding, text escaping, deterministic UIDs + a fixed
DTSTAMP so re-exports are byte-identical) and triggers a Blob download
(`src/lib/export/download.ts`) named from the sanitized trip title. A hop-less
plan yields a valid event-free calendar; undated `stay:`-only plans still export,
since `resolve()` chains concrete dates.

**Problem:** A trip plan's whole point is to be _used while traveling_ — on a
phone, printed, or in a calendar. Today the artifact is trapped in one browser's
localStorage. Users resort to screenshots, which lose timeline/budget detail.

**Suggestion:** Two low-surface exports off a single "Export" menu:

1. **Print / Save as PDF** — a print stylesheet laying out summary + timeline +
   per-hop details (optionally the map) cleanly; the browser's own print-to-PDF
   does the heavy lifting (no dependency).
2. **Add to calendar (.ics)** — one all-day event per hop (and fixed `@date`
   activities as timed events) from the already-resolved dates. Pure
   string-building, no backend.

**Impact:** Makes the plan portable and usable away from the app. The .ics path
removes the "copy each hop into my calendar" toil entirely.

## 3. Disambiguate geocoding instead of silently guessing — DONE

**Type:** Friction removal · **Effort:** Medium
**Area:** src/state/use-geocoder.ts, src/geocode/nominatim.ts, MapView/status

_Implemented._ Nominatim now returns up to 5 candidates (cached alongside the
primary result, so no extra requests). A conservative heuristic
(`src/geocode/ambiguity.ts`) flags a name as ambiguous only when the top two
matches are far apart (>100km) and similarly relevant (runner-up ≥75% of the
top's importance). Auto-pick-first stays the default; only ambiguous, still-geocoded
hops surface a tiny inline chooser in the map status area ("Which Venice? Venice,
Veneto, Italy · Venice, Florida, USA"). Picking a candidate writes `coords:` via
the #4 helper.

**Problem:** "Venice", "Springfield", "Paris" resolve to a single Nominatim guess
with no confirmation. The user can't tell a correct match from a wrong one until
the pin lands in the wrong country — and fixing it is painful (see #4). Silent
wrong-guesses are the worst kind of error: invisible until they bite.

**Suggestion:** When a name has multiple plausible matches, surface a tiny inline
chooser (on the "ambiguous" status, or a marker click): "Venice, Italy · Venice,
FL, USA". Picking one writes `coords:` (reusing the drag-to-place plumbing from
#4). Keep auto-pick-first as the default so nothing slows for unambiguous names —
only offer the choice when confidence is low.

**Impact:** Removes a whole class of silent errors and their rework. Zero added
steps for the common, unambiguous case.

## 4. Drag a pin / click the map to place or nudge a location — DONE

**Type:** Friction removal · **Effort:** Medium
**Area:** src/components/MapView.tsx, src/dsl/\* (writes `coords:`)

_Implemented._ Hop pins are now draggable; on drop the new lat/lng is written as
a `coords:` line on that hop via a pure helper (`setHopCoords` in
`src/dsl/edit.ts`, which inserts or replaces in place, matching the parser's
`lat, lng` format at ~1m precision). Clicking the map places the **active** hop
(the one currently hovered/selected); with no active hop a click is a no-op so it
never edits an arbitrary hop. Because the edit goes through the DSL text, it
round-trips into the editor and autosave with no side model.

**Problem:** Every placement correction means leaving the map, finding the right
hop in the textarea, and hand-typing `coords: lat, lng`. When geocoding guesses
wrong (or can't find a place), there's no in-context way to fix it.

**Suggestion:** Let the user drag a hop/stop marker, or click the map to set the
active hop's location. On drop, write `coords: <lat>, <lng>` into that hop in the
DSL (the editor is already the source of truth, so this just edits text). No new
mode — direct manipulation that round-trips to the DSL.

**Impact:** Turns a multi-step textarea hunt + manual coordinate entry into one
drag. Directly fixes the "Couldn't locate" dead-end.

## 5. Quick-add a hop without learning the syntax — DONE

**Type:** Friction removal · **Effort:** Low
**Area:** src/components/Toolbar.tsx or Timeline, src/dsl/\* (appends a hop)

_Implemented._ A "+ Add hop" button at the end of the Timeline (and on its empty
state) appends a correctly-formed `hop New stop:` / `stay: 2d` block to the DSL
via the pure `appendHop` helper in `src/dsl/edit.ts`, then focuses the editor and
selects the placeholder name so the user can rename it immediately. The DSL stays
the single source of truth — the append round-trips through parse→resolve→render
and autosaves like any keystroke. Duplicate placeholder names are allowed (the
parser reads each as its own hop), so repeated clicks just stack `New stop` hops.

**Problem:** Adding the first few hops requires knowing the `hop Name:` / `stay:
Nd` shape. Autocomplete helps once you're typing, but the blank-page "how do I
start a hop" moment is real for newcomers.

**Suggestion:** An "+ Add hop" affordance (e.g. at the end of the timeline) that
appends a correctly-formed `hop New stop:` / `stay: 2d` block to the DSL and
focuses that line for renaming. It writes valid DSL for the user — keeping text
as the single source of truth — instead of introducing a separate form.

**Impact:** Removes the blank-page syntax barrier; the user learns the shape by
seeing the generated block rather than reading docs first.

## 6. First-run nudge so the text-as-UI model is obvious — DONE

**Type:** Friction removal · **Effort:** Low
**Area:** src/components/Editor.tsx, src/App.tsx, Toolbar

_Implemented._ A one-line, dismissible hint (`src/components/FirstRunHint.tsx`)
renders above the editor only on a genuine first visit — no named save slots AND
the dismissal flag is unset (`isFirstRunHintDismissed`/`dismissFirstRunHint` in
`src/state/store.ts`, key `rejs.firstRunHintDismissed.v1`). Its "Open the DSL
guide" button reuses the same `HelpModal` the toolbar already opens (the help
state lives in `App`, so both share one handler). Dismissal persists, so it never
returns for that browser and never shows for returning users with saved plans.

**Problem:** The app _is_ a text editor that drives a map, but a first-time user
sees a pre-filled textarea and may not realize they're meant to edit it (or that
the "DSL guide" is the manual). The mental model is unusual; discovery is left to
chance.

**Suggestion:** A one-line, dismissible hint above the editor on first visit (no
saved plans yet): "Edit this text to change your trip — the map updates live. New
here? Open the DSL guide." Persist dismissal in localStorage. No modal, no tour —
one sentence that sets the model and points to existing help.

**Impact:** Shortens time-to-understanding for new users without adding friction
for returning ones (it never shows again).

## 7. Trip duration & date sanity hints (lightweight) — DONE

**Type:** Friction removal · **Effort:** Low
**Area:** src/dsl/resolve.ts diagnostics, src/components/Summary.tsx

_Implemented._ A pure `dateDiagnostics(parsed, resolved)` in `src/dsl/resolve.ts`
emits two high-signal **warnings** (never errors) into the existing diagnostics
channel (`App` merges them with the parse diagnostics; `Diagnostics.tsx` already
renders warnings distinctly): (1) a fixed-date `activity @ <date>` that falls
outside its hop's resolved window (boundaries inclusive); (2) a gap/overlap
between two hops where the later one carries an **explicit** `dates:` start that
doesn't meet the previous hop's end. Chained `stay:`-only hops abut by
construction and are never flagged, so undated plans produce zero new warnings.

**Problem:** It's easy to build a plan with subtle date problems — overlapping hop
windows, a fixed `@date` activity outside its hop's dates, or a trip accidentally
far longer/shorter than intended — and not notice, because nothing flags it.

**Suggestion:** Add a couple of gentle _warnings_ (not errors) in the existing
diagnostics channel: activity date outside its hop window; gaps between hop dates.
Reuse the diagnostics list users already trust; no new UI surface. Keep it to
high-signal checks so the list doesn't turn noisy.

**Impact:** Catches real planning mistakes at author time, where they're cheap to
fix, using machinery that already exists.
