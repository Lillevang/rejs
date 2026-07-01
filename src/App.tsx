import { useEffect, useMemo, useState } from "react";
import { Toolbar } from "./components/Toolbar";
import { Editor } from "./components/Editor";
import { Diagnostics } from "./components/Diagnostics";
import { MapView } from "./components/MapView";
import { Timeline } from "./components/Timeline";
import { Summary } from "./components/Summary";
import { HelpModal } from "./components/HelpModal";
import { FirstRunHint } from "./components/FirstRunHint";
import { OrientationHint } from "./components/OrientationHint";
import { useResizableHeight } from "./state/use-resizable-height";
import {
  activityQuery,
  type DisplayActivity,
  type DisplayDriveStop,
  type DisplayHop,
  type DisplayWaypoint,
  type LocationState,
} from "./components/display";
import type { LatLng, Waypoint } from "./dsl/types";
import type { LocationStatus } from "./state/use-geocoder";
import { parse } from "./dsl/parse";
import { dateDiagnostics, resolve } from "./dsl/resolve";
import { appendHop, setHopCoords } from "./dsl/edit";
import { isAmbiguous } from "./geocode/ambiguity";
import { colorForIndex } from "./lib/colors";
import { EXAMPLE_DSL } from "./lib/example";
import { decodePlanHash, decodeShareSlug } from "./lib/share";
import { makeShareLink } from "./lib/share-link";
import { icsFilename, planToIcs } from "./lib/export/ics";
import { downloadTextFile } from "./lib/export/download";
import {
  deletePlan,
  dismissFirstRunHint,
  isFirstRunHintDismissed,
  listPlans,
  loadCurrent,
  loadPlan,
  saveCurrent,
  savePlan,
} from "./state/store";
import { geocodeKey, useGeocoder } from "./state/use-geocoder";
import { PHONE_QUERY, useMediaQuery } from "./state/use-media-query";

type MobileTab = "map" | "plan" | "edit";

export default function App() {
  // A `#plan=…` share link wins over the autosaved buffer on first load; from
  // then on it's an ordinary local edit (autosaved like anything else).
  const [dsl, setDsl] = useState<string>(
    () => decodePlanHash(globalThis.location?.hash ?? "") ?? loadCurrent(),
  );
  const [plans, setPlans] = useState<string[]>(() => listPlans());
  // The short-link slug tied to the current buffer, if any. Learned from the
  // `&s=` in an opened share link, or minted on first share; reused so edits
  // update the same short link instead of minting a new one. Reset to null when
  // a different plan is loaded (that content isn't what the short link points to).
  const [shareSlug, setShareSlug] = useState<string | null>(() =>
    decodeShareSlug(globalThis.location?.hash ?? ""),
  );
  // The named slot the buffer was last saved to or loaded from, or null for a
  // never-saved buffer. Drives "Save" (overwrite in place) vs. "Save as…", and
  // the "unsaved changes" indicator below.
  const [loadedName, setLoadedName] = useState<string | null>(null);
  const [activeHopId, setActiveHopId] = useState<string | null>(null);
  const [focusLine, setFocusLine] = useState<number | null>(null);
  const [focusRange, setFocusRange] = useState<[number, number] | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  // The first-run hint shows only on a genuine first visit: no named save slots
  // yet AND the user hasn't dismissed it before. Both reads happen once on mount;
  // dismissal persists to localStorage so it never reappears.
  const [hintDismissed, setHintDismissed] = useState(() => isFirstRunHintDismissed());
  const { height: timelineHeight, handleProps } = useResizableHeight("rejs.timelineHeight", 220);
  // Below the phone breakpoint the three views can't share the screen, so they
  // become full-bleed tabs. The map is the default (the most useful artifact to
  // carry while traveling); the editor is summoned via the Edit tab.
  const isPhone = useMediaQuery(PHONE_QUERY);
  const [mobileTab, setMobileTab] = useState<MobileTab>("map");

  // Parse + resolve on every edit. Both are pure and cheap, so no debounce needed.
  const { trip, diagnostics: parseDiagnostics } = useMemo(() => parse(dsl), [dsl]);
  const resolved = useMemo(() => resolve(trip), [trip]);
  // Layer gentle date-sanity warnings (activity outside its hop window, gaps
  // between dated hops) onto the parse diagnostics, sorted by line so the list
  // reads top-to-bottom regardless of which pass produced each entry.
  const diagnostics = useMemo(
    () => [...parseDiagnostics, ...dateDiagnostics(trip, resolved)].sort((a, b) => a.line - b.line),
    [parseDiagnostics, trip, resolved],
  );

  const names = useMemo(() => {
    const list: string[] = [];
    for (const h of resolved.hops) {
      if (!h.coords) list.push(h.name);
      for (const a of h.activities ?? []) list.push(activityQuery(a.name, h.name));
      for (const s of h.driveStops ?? []) list.push(s.name);
    }
    if (resolved.start && !resolved.start.coords) list.push(resolved.start.name);
    if (resolved.end && !resolved.end.coords) list.push(resolved.end.name);
    return list;
  }, [resolved]);
  const { locations, candidates } = useGeocoder(names);

  // Diagnostic counts drive the Edit-tab badge on mobile (so problems are
  // visible even when the editor is on a hidden tab).
  const errorCount = diagnostics.filter((d) => d.severity === "error").length;
  const warningCount = diagnostics.filter((d) => d.severity === "warning").length;

  // Turn a geocoder status into a (location, state) pair for the UI.
  const fromStatus = (
    status: LocationStatus | undefined,
  ): { location: LatLng | null; locationState: LocationState } => {
    if (status === "notfound") return { location: null, locationState: "notfound" };
    if (status && status !== "loading") return { location: status, locationState: "ok" };
    return { location: null, locationState: "loading" };
  };

  // Resolve a start/end waypoint to its location, mirroring the hop logic.
  const locateWaypoint = (wp: Waypoint | undefined): DisplayWaypoint | null => {
    if (!wp) return null;
    if (wp.coords) return { name: wp.name, location: wp.coords, locationState: "manual" };
    return { name: wp.name, ...fromStatus(locations[geocodeKey(wp.name)]) };
  };
  const displayStart = useMemo(
    () => locateWaypoint(resolved.start),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [resolved.start, locations],
  );
  const displayEnd = useMemo(
    () => locateWaypoint(resolved.end),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [resolved.end, locations],
  );

  const displayHops = useMemo<DisplayHop[]>(
    () =>
      resolved.hops.map((hop, index) => {
        const color = colorForIndex(index);
        const activities: DisplayActivity[] = (hop.activities ?? []).map((activity) => ({
          activity,
          ...fromStatus(locations[geocodeKey(activityQuery(activity.name, hop.name))]),
        }));
        const driveStops: DisplayDriveStop[] = (hop.driveStops ?? []).map((stop) => ({
          stop,
          ...fromStatus(locations[geocodeKey(stop.name)]),
        }));
        const base = { hop, index, color, activities, driveStops };
        if (hop.coords) {
          return { ...base, location: hop.coords, locationState: "manual" };
        }
        return { ...base, ...fromStatus(locations[geocodeKey(hop.name)]) };
      }),
    [resolved, locations],
  );

  // Direct manipulation (drag a pin, click the map, pick a disambiguation
  // candidate) writes `coords:` into the hop's source line — the DSL stays the
  // single source of truth, so the edit round-trips into the editor and autosave.
  const moveHop = (hopId: string, lat: number, lng: number) => {
    const hop = resolved.hops.find((h) => h.id === hopId);
    if (!hop) return;
    setDsl((current) => setHopCoords(current, hop.line, lat, lng));
  };

  // Quick-add a hop: append a valid `hop New stop:` block to the DSL (the single
  // source of truth) and select its placeholder name in the editor so the user
  // can immediately type a real name. The change autosaves like any edit.
  const addHop = () => {
    const { text, nameStart, nameEnd } = appendHop(dsl);
    setDsl(text);
    setFocusRange([nameStart, nameEnd]);
  };

  // Map click places the *active* hop (the one currently hovered/selected). With
  // no active hop there's no sensible target, so a click is a no-op rather than a
  // surprise edit to some arbitrary hop.
  const placeActiveHop = (lat: number, lng: number) => {
    if (activeHopId == null) return;
    moveHop(activeHopId, lat, lng);
  };

  // Hops worth offering a disambiguation choice for: still geocoded (no manual
  // `coords:`) and resolved to genuinely competing matches. Auto-pick-first stays
  // the default, so unambiguous names never appear here (zero added steps).
  const ambiguousHops = useMemo(
    () =>
      displayHops
        .filter((h) => !h.hop.coords)
        .map((h) => ({ hop: h.hop, candidates: candidates[geocodeKey(h.hop.name)] ?? [] }))
        .filter((h) => isAmbiguous(h.candidates)),
    [displayHops, candidates],
  );

  // Once a shared plan is loaded into state, strip the hash so a later reload
  // restores the user's own edits (from autosave) rather than the original link.
  useEffect(() => {
    if (decodePlanHash(globalThis.location.hash)) {
      const { pathname, search } = globalThis.location;
      globalThis.history.replaceState(null, "", pathname + search);
    }
  }, []);

  // On a phone, track the visual viewport height in a CSS var so the layout
  // shrinks to the space *above* the soft keyboard (instead of the keyboard
  // covering the active editor line). No-op when visualViewport is unavailable.
  useEffect(() => {
    const vv = globalThis.visualViewport;
    if (!isPhone || !vv) {
      document.documentElement.style.removeProperty("--app-vh");
      return;
    }
    const sync = () => {
      document.documentElement.style.setProperty("--app-vh", `${vv.height}px`);
    };
    sync();
    vv.addEventListener("resize", sync);
    vv.addEventListener("scroll", sync);
    return () => {
      vv.removeEventListener("resize", sync);
      vv.removeEventListener("scroll", sync);
      document.documentElement.style.removeProperty("--app-vh");
    };
  }, [isPhone]);

  // Autosave the working buffer (debounced) so a reload restores the journey.
  useEffect(() => {
    const id = setTimeout(() => saveCurrent(dsl), 400);
    return () => clearTimeout(id);
  }, [dsl]);

  // Clear the one-shot focus request after the editor consumes it.
  useEffect(() => {
    if (focusLine == null) return;
    const id = setTimeout(() => setFocusLine(null), 0);
    return () => clearTimeout(id);
  }, [focusLine]);

  // Clear the one-shot range-focus request after the editor consumes it.
  useEffect(() => {
    if (focusRange == null) return;
    const id = setTimeout(() => setFocusRange(null), 0);
    return () => clearTimeout(id);
  }, [focusRange]);

  // The buffer is "dirty" when it's tied to a named slot whose stored content no
  // longer matches. A never-saved buffer has no slot to diverge from, so it's
  // never flagged. Cheap string compare on every render; the DSL is small.
  const dirty = loadedName != null && loadPlan(loadedName) !== dsl;

  // Show the nudge only for a true newcomer: no saved plans and not yet
  // dismissed. Returning users (who have saved at least one plan) never see it.
  const showHint = !hintDismissed && plans.length === 0;
  const dismissHint = () => {
    dismissFirstRunHint();
    setHintDismissed(true);
  };

  const waypoints = [displayStart, displayEnd].filter((w): w is DisplayWaypoint => w !== null);
  const activityStates = displayHops.flatMap((h) => h.activities.map((a) => a.locationState));
  const driveStops = displayHops.flatMap((h) => h.driveStops);
  const pending =
    displayHops.filter((h) => h.locationState === "loading").length +
    waypoints.filter((w) => w.locationState === "loading").length +
    activityStates.filter((s) => s === "loading").length +
    driveStops.filter((s) => s.locationState === "loading").length;
  // Hops, waypoints and drive stops surface "couldn't locate" (a drive stop must
  // be placed to draw the route). Activities don't, since vague ones ("beach
  // day") are expected to have no place and shouldn't read as errors.
  const notFound = [
    ...displayHops.filter((h) => h.locationState === "notfound").map((h) => h.hop.name),
    ...waypoints.filter((w) => w.locationState === "notfound").map((w) => w.name),
    ...driveStops.filter((s) => s.locationState === "notfound").map((s) => s.stop.name),
  ];

  // On a phone, tapping a timeline row (or summary, via the same handler) makes
  // that hop active and jumps to the map so you can see where it is. Reuses the
  // existing activeHopId/onHover wiring — no new state, tap bound to hover.
  const focusHopOnMap = (hopId: string | null) => {
    setActiveHopId(hopId);
    if (isPhone && hopId != null) setMobileTab("map");
  };

  // Build the share URL on demand: prefer a stable short link via the
  // url-shortener, falling back to the long self-contained link if it's
  // unavailable. Persist any minted/updated slug so later edits update the same
  // short link rather than minting a new one.
  const getShareUrl = async () => {
    const { url, slug } = await makeShareLink(dsl, shareSlug);
    if (slug !== shareSlug) setShareSlug(slug);
    return url;
  };

  const geostatus = (
    <div className="app__geostatus">
      {pending > 0 && <span>Locating {pending}…</span>}
      {notFound.length > 0 && (
        <span className="app__geostatus--warn">Couldn’t locate: {notFound.join(", ")}</span>
      )}
      {ambiguousHops.map(({ hop, candidates: list }) => (
        <div key={hop.id} className="app__disambig" data-hop={hop.name}>
          <span className="app__disambig-label">Which {hop.name}?</span>
          {list.slice(0, 3).map((c) => (
            <button
              key={`${c.lat},${c.lng}`}
              type="button"
              className="app__disambig-option"
              title={c.label}
              onClick={() => moveHop(hop.id, c.lat, c.lng)}
            >
              {c.label}
            </button>
          ))}
        </div>
      ))}
    </div>
  );

  const mapView = (
    <MapView
      hops={displayHops}
      start={displayStart}
      end={displayEnd}
      activeHopId={activeHopId}
      onHover={setActiveHopId}
      onHopMove={moveHop}
      onMapClick={placeActiveHop}
    />
  );

  const editorPanel = (
    <>
      {showHint && <FirstRunHint onShowHelp={() => setHelpOpen(true)} onDismiss={dismissHint} />}
      <Editor
        value={dsl}
        diagnostics={diagnostics}
        focusLine={focusLine}
        focusRange={focusRange}
        onChange={setDsl}
      />
      <Diagnostics diagnostics={diagnostics} onSelect={setFocusLine} />
    </>
  );

  if (isPhone) {
    return (
      <div className="app app--phone">
        <Toolbar
          plans={plans}
          loadedName={loadedName}
          dirty={dirty}
          compact
          onSave={() => {
            if (loadedName == null) return;
            savePlan(loadedName, dsl);
            setPlans(listPlans());
          }}
          onSaveAs={(name) => {
            savePlan(name, dsl);
            setPlans(listPlans());
            setLoadedName(name);
          }}
          onLoad={(name) => {
            const text = loadPlan(name);
            if (text != null) {
              setDsl(text);
              setLoadedName(name);
              setShareSlug(null);
            }
          }}
          onDelete={(name) => {
            deletePlan(name);
            setPlans(listPlans());
            if (name === loadedName) setLoadedName(null);
          }}
          onLoadExample={() => {
            setDsl(EXAMPLE_DSL);
            setLoadedName(null);
            setShareSlug(null);
          }}
          onShowHelp={() => setHelpOpen(true)}
          onPrint={() => window.print()}
          onDownloadIcs={() =>
            downloadTextFile(icsFilename(resolved.title), planToIcs(resolved), "text/calendar")
          }
          shareUrl={getShareUrl}
        />

        <main className="app__mobile-view">
          {/* The map stays mounted and is hidden (full size, out of flow) when
              off-tab, so Leaflet keeps the user's pan/zoom across tab switches —
              the common round-trip for the map-first job. The Plan and Edit
              panels derive purely from the DSL, so unmounting them loses no
              view state. */}
          <div className={`app__mobile-map${mobileTab === "map" ? "" : " app__mobile-hidden"}`}>
            {mapView}
            {geostatus}
          </div>
          {mobileTab === "plan" && (
            <div className="app__mobile-plan">
              <Summary trip={resolved} />
              <OrientationHint show={displayHops.length > 0} />
              <div className="app__mobile-timeline">
                <Timeline
                  hops={displayHops}
                  activeHopId={activeHopId}
                  onHover={focusHopOnMap}
                  onAddHop={addHop}
                />
              </div>
            </div>
          )}
          {mobileTab === "edit" && <div className="app__mobile-edit">{editorPanel}</div>}
        </main>

        <nav className="app__tabs" aria-label="Views">
          <button
            type="button"
            className={`app__tab${mobileTab === "map" ? " app__tab--active" : ""}`}
            aria-pressed={mobileTab === "map"}
            onClick={() => setMobileTab("map")}
          >
            Map
          </button>
          <button
            type="button"
            className={`app__tab${mobileTab === "plan" ? " app__tab--active" : ""}`}
            aria-pressed={mobileTab === "plan"}
            onClick={() => setMobileTab("plan")}
          >
            Plan
          </button>
          <button
            type="button"
            className={`app__tab${mobileTab === "edit" ? " app__tab--active" : ""}`}
            aria-pressed={mobileTab === "edit"}
            onClick={() => setMobileTab("edit")}
          >
            Edit
            {(errorCount > 0 || warningCount > 0) && (
              <span
                className={`app__tab-badge${errorCount > 0 ? " app__tab-badge--error" : " app__tab-badge--warning"}`}
                aria-hidden="true"
              >
                {errorCount > 0 ? errorCount : warningCount}
              </span>
            )}
          </button>
        </nav>

        <HelpModal open={helpOpen} onClose={() => setHelpOpen(false)} />
      </div>
    );
  }

  return (
    <div className="app">
      <Toolbar
        plans={plans}
        loadedName={loadedName}
        dirty={dirty}
        onSave={() => {
          if (loadedName == null) return;
          savePlan(loadedName, dsl);
          setPlans(listPlans());
        }}
        onSaveAs={(name) => {
          savePlan(name, dsl);
          setPlans(listPlans());
          setLoadedName(name);
        }}
        onLoad={(name) => {
          const text = loadPlan(name);
          if (text != null) {
            setDsl(text);
            setLoadedName(name);
          }
        }}
        onDelete={(name) => {
          deletePlan(name);
          setPlans(listPlans());
          if (name === loadedName) setLoadedName(null);
        }}
        onLoadExample={() => {
          setDsl(EXAMPLE_DSL);
          setLoadedName(null);
        }}
        onShowHelp={() => setHelpOpen(true)}
        onPrint={() => window.print()}
        onDownloadIcs={() =>
          downloadTextFile(icsFilename(resolved.title), planToIcs(resolved), "text/calendar")
        }
        shareUrl={getShareUrl}
      />

      <div className="app__body">
        <aside className="app__sidebar">{editorPanel}</aside>

        <main className="app__main">
          <Summary trip={resolved} />
          {mapView}
          {geostatus}
          <div
            className="app__divider"
            role="separator"
            aria-orientation="horizontal"
            aria-label="Drag to resize the map and timeline"
            {...handleProps}
          >
            <span className="app__divider-grip" />
          </div>
          <div className="app__timeline" style={{ height: timelineHeight }}>
            <Timeline
              hops={displayHops}
              activeHopId={activeHopId}
              onHover={setActiveHopId}
              onAddHop={addHop}
            />
          </div>
        </main>
      </div>

      <HelpModal open={helpOpen} onClose={() => setHelpOpen(false)} />
    </div>
  );
}
