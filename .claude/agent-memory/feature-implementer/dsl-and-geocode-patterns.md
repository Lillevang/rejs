---
name: dsl-and-geocode-patterns
description: Non-obvious rejs patterns for writing back to the DSL text and for the geocoder cache/candidates
metadata:
  type: project
---

Facts about rejs's DSL-write and geocode plumbing that aren't obvious from a first read:

- **Mapping a rendered marker back to its source text** uses the 1-based `line` field every `Hop`/`Waypoint`/`Activity`/`DriveStop` carries (set by `parse.ts`). To edit a hop's text from a view, pass its `ResolvedHop.line` to a text-rewriting helper — no offsets or AST round-trip needed.

- **Direct-manipulation edits go through `src/dsl/edit.ts`** (`setHopCoords(text, headerLine, lat, lng)` + `formatCoords`). It's a pure string edit: finds the hop body (header line → next unindented line), replaces an existing `coords:` in place or inserts one after the header, matching body indentation. The DSL is the single source of truth, so `App` just does `setDsl(s => setHopCoords(s, ...))` and the change round-trips into the editor + autosave. coords format is `lat, lng` (comma-space) rounded to 5 decimals — must match `parseCoords` in `parse.ts`.

- **Geocoder returns candidates, not just one match.** `nominatim.ts` queries `limit=5` and caches the whole candidate list per key; `geocode()` returns candidate #0 (unchanged behavior), `geocodeCandidates()` returns all. `useGeocoder` now returns `{ locations, candidates }` (was a bare map) — update callers if you touch it. **Bump the cache key (`rejs.geocode.vN`) whenever the cached entry shape changes** — the current key is `v2` (entry is `{found, candidates[]}`, was `{lat,lng,found}` in v1).

- **Ambiguity detection** is `src/geocode/ambiguity.ts` (`isAmbiguous`): conservative — needs ≥2 candidates that are >100km apart AND runner-up importance ≥75% of the top. Default stays auto-pick-first; the inline chooser in the map status area only appears for genuinely ambiguous, still-geocoded hops. See [[testing-setup]] for how to seed the geocode cache in e2e to force ambiguity deterministically.
