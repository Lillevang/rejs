---
name: app-overview
description: What rejs is (a text-DSL journey planner) and its core UX surfaces, for UX reviews
metadata:
  type: project
---

rejs is a backend-free journey/trip planner. The user writes a plain-text DSL describing a trip (trip title, currency, start/end waypoints, `hop` stops with dates/stay/budget/transport/activities, `drive` blocks with overnight stops, manual coords, notes). The app parses + resolves on every keystroke (pure, no debounce) and renders three live views.

**Why:** It's an MVP on branch feat/journey-planner-mvp. Stays deliberately small and backend-free; localStorage is the only persistence.

**How to apply:** When proposing features, respect the "stays small, simple, backend-free, least surface area" constraint stated at the top of IDEAS.md. Prefer URL/localStorage/derived-state solutions over anything needing a server.

Layout (src/App.tsx):

- Toolbar: brand, Save (name input + button), Saved-plans select + Load/Delete, DSL guide, Load example.
- Left sidebar: Editor (textarea with autocomplete, Tab indent, caret-positioned suggestions, valid/errors/warnings badge) + Diagnostics list (click a diagnostic to jump to the line).
- Right main: Summary (stops / total days / budget-by-currency), Leaflet MapView (numbered pins, colored legs, dashed for flight/ferry, activity pins, drive stops, start/end markers, leg-time labels), a drag-resizable divider, and a Timeline (Gantt-style bars per hop/drive-stop with dates + budget).
- Geocoding: Nominatim via src/geocode/nominatim.ts, deduped/cached; App shows "Locating N…" and "Couldn't locate: …" status text.
- Persistence: localStorage. Autosaved "current" buffer (400ms debounce) + named plan slots (store.ts).

Key files: src/App.tsx, src/components/{Toolbar,Editor,Diagnostics,MapView,Timeline,Summary,HelpModal}.tsx, src/dsl/{parse,resolve,types}.ts, src/lib/{example,dsl-reference,format,dates,colors}.ts, src/state/{store,use-geocoder,use-resizable-height}.ts.
