// Single source of truth for the in-app "DSL guide" modal.
//
// IMPORTANT: whenever the DSL gains or changes a feature (a new field, block, or
// syntax), add or update a section here so the guide stays current. Every
// snippet below is parsed by dsl-reference.test.ts and must stay error-free, so
// the guide can't silently drift out of sync with the parser.

export interface DslSection {
  title: string;
  description: string;
  code: string;
}

export const DSL_REFERENCE: DslSection[] = [
  {
    title: "Trip basics",
    description: "Give the trip a title and a default currency for budgets.",
    code: `trip "Grand Tour"
currency: EUR`,
  },
  {
    title: "Start & end points",
    description:
      "Where the journey begins and ends, drawn as markers joined to the first and last hop. Use a place name or `lat, lng`.",
    code: `start: Copenhagen
end: Copenhagen

hop Berlin:
  stay: 3d`,
  },
  {
    title: "Hops & dates",
    description:
      "Each `hop` is a stop. Give it an explicit window with `dates:`, or a length with `stay: Nd` and let it chain from the previous hop.",
    code: `hop Berlin:
  dates: 2026-07-01 .. 2026-07-04
hop Prague:
  stay: 2d`,
  },
  {
    title: "Budget",
    description:
      "Per-hop budget, summed per currency. A bare amount uses the trip's default currency.",
    code: `currency: EUR
hop Rome:
  budget: 800 EUR`,
  },
  {
    title: "Transport & travel time",
    description:
      "How you arrive into a hop, and how long the leg takes (shown on the map line). Modes: flight, train, bus, ferry, car, walk.",
    code: `hop Vienna:
  arrive_by: train
  travel: 4h 30m`,
  },
  {
    title: "Activities",
    description:
      "Optional things to do at a hop, geocoded and marked on the map. Add `@ YYYY-MM-DD` for a fixed, must-book date; leave it off for a flexible plan.",
    code: `hop Paris:
  stay: 3d
  activity: Louvre
  activity: Eiffel Tower @ 2026-07-02`,
  },
  {
    title: "Road trips (drive blocks)",
    description:
      "Break a drive into overnight stops with a `drive` block between two hops. Each `stop:` is one night by default; add `2d` for more. Stops consume nights and appear on the map and timeline.",
    code: `hop Sydney:
  stay: 6d
drive -> Melbourne:
  by: car
  stop: Canberra
  stop: Lakes Entrance 2d
hop Melbourne:
  stay: 4d
  arrive_by: car`,
  },
  {
    title: "Manual coordinates",
    description: "Pin a hop precisely (or somewhere geocoding can't find) with `coords: lat, lng`.",
    code: `hop Hidden Beach:
  coords: 13.37, 103.86
  stay: 2d`,
  },
  {
    title: "Notes & comments",
    description:
      "Add a free-text `note:` to a hop, and `#` comments anywhere (ignored by the parser).",
    code: `# A two-week loop
hop Tokyo:  # inline comments work too
  stay: 5d
  note: "Stay near Shinjuku"`,
  },
];
