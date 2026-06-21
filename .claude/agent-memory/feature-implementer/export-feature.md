---
name: export-feature
description: How the plan-export (print + .ics) feature is wired in rejs and its non-obvious design choices
metadata:
  type: project
---

Idea #2 (export plan: print/PDF + .ics) is implemented. Where things live and the non-obvious calls:

- **Pure .ics builder:** `src/lib/export/ics.ts` — `planToIcs(resolved: ResolvedTrip): string` + `icsFilename(title)`. **The exclusive all-day `DTEND` is just `hop.endDate`** — `resolve()` already makes `endDate` the exclusive checkout day (it's `addDays(start, nights)`), so NO off-by-one adjustment is needed. Activities are all-day single-day events (`@date` → `endExclusive = date + 1`). Determinism: fixed `DTSTAMP=20000101T000000Z`, UIDs from the deterministic `hop-N` / `act-N` ids the parser assigns (`hop-${index}@rejs.local`, `activity-${activity.id}@rejs.local`). CRLF endings, 75-octet line folding (byte-based), RFC 5545 text escaping. Empty/hop-less plan → valid event-free VCALENDAR; undated stay-only plans still export (dates chain off the trip start).

- **DOM download:** `src/lib/export/download.ts` — `downloadTextFile(filename, content, type)` (Blob + object URL + transient anchor). Kept separate from the pure builder so it's stubbable. **Test gotcha:** `vi.stubGlobal("URL", ...)` is NOT undone by `vi.restoreAllMocks()` — must also call `vi.unstubAllGlobals()` in afterEach or the patched URL leaks to other files.

- **Export menu:** in `src/components/Toolbar.tsx` (new `onPrint`/`onDownloadIcs` props, wired in `App.tsx` to `window.print()` and the download). Small accessible dropdown (button with `aria-haspopup`/`aria-expanded`, `role=menu`/`menuitem`); closes on outside `mousedown` + Escape via a `useEffect` listener.

- **Print CSS:** `@media print` block at the end of `src/styles.css`. **The map is deliberately EXCLUDED from print** (Leaflet tiles/panes print blank/clipped and add little on paper). Hide `.map` (the bordered wrapper, NOT `.map__container` — hiding only the inner leaves an empty 140px bordered box). Also hide `.timeline__footer` (the "+ Add hop" button is interactive chrome). Must release the on-screen viewport lock: `html, body, #root, .app, .app__body, .app__main { height:auto; overflow:visible; display:block }`, and `.app__timeline { height:auto }` (its on-screen height is set inline from JS). The print artifact = Summary cards + Timeline.

- **e2e:** asserting an .ics download uses Playwright's `page.waitForEvent("download")` + `download.suggestedFilename()` + `download.createReadStream()`. The print action is verified by stubbing `window.print` to set a window flag and polling it. See [[testing-setup]] for the record-feature recording recipe (dev server up first, then temp config with `video:"on"`).
