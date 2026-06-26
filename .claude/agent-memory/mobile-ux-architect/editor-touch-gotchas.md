---
name: editor-touch-gotchas
description: Editor.tsx and MapView touch/keyboard gotchas for mobile — caret-pixel autocomplete, key-only accept, soft-keyboard occlusion, Leaflet gestures
metadata:
  type: project
---

Editor (src/components/Editor.tsx):

- It IS the app — a controlled `<textarea>`. Do not replace it; make it survive mobile.
- Autocomplete list is absolutely positioned at the _caret pixel_ (`caretCoordinates` mirror-div measurement). On a phone this can land off-screen or under the soft keyboard. Mobile wants a fixed strip pinned above the keyboard instead.
- Suggestion navigation is hardware-key only: ArrowUp/Down/Enter/Tab/Esc in `onKeyDown`. A soft keyboard has none of these reliably. Tap-accept already works via `onMouseDown` on the `<li>` — but the list must be reachable.
- `getCompletionContext(value, caret)` in editor-suggest.ts computes context-valid tokens — reuse this for both the suggestion strip (M3) and a token accessory bar (M4).
- Tab key inserts 2-space indent (`INDENT`). No Tab on soft keyboards → token bar should offer indent + `:` + `@`.

MapView (src/components/MapView.tsx):

- `MapContainer` has `scrollWheelZoom worldCopyJump` but NO explicit touch config. Leaflet enables touch by default; the real risk is pan-vs-page-scroll fight when the map is inside a scrolling column. M1's full-bleed map removes that for the primary surface.
- Marker hit targets are small: activity dots 12px, drive stops 16px (well under 44px). Hover tooltips have no touch equivalent — bind tap-to-select to `activeHopId` on coarse pointers (M6).
- Map detail is shown via Leaflet `<Tooltip>` (hover). On touch, surface detail in the sheet instead.

Detect touch with `@media (pointer: coarse)` / `matchMedia`, NOT UA sniffing.
