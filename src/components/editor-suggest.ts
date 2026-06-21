import { TRANSPORT_MODES } from "../dsl/types";

/** A single autocomplete entry. `insert` replaces the typed token. */
export interface Suggestion {
  label: string;
  insert: string;
}

export interface CompletionContext {
  /** The partial token under the caret that will be replaced on accept. */
  token: string;
  /** Index in the full text where the token starts. */
  start: number;
  items: Suggestion[];
}

// Directives valid at the top level (no indentation).
const TOP_LEVEL: Suggestion[] = [
  { label: "hop", insert: "hop " },
  { label: "drive", insert: "drive -> " },
  { label: "trip", insert: "trip " },
  { label: "currency:", insert: "currency: " },
  { label: "start:", insert: "start: " },
  { label: "end:", insert: "end: " },
];

// Fields valid inside a `drive` block.
const DRIVE_FIELDS: Suggestion[] = [
  { label: "stop:", insert: "stop: " },
  { label: "by:", insert: "by: " },
];

// Fields valid inside a hop block (indented).
const HOP_FIELDS: Suggestion[] = [
  { label: "dates:", insert: "dates: " },
  { label: "stay:", insert: "stay: " },
  { label: "budget:", insert: "budget: " },
  { label: "arrive_by:", insert: "arrive_by: " },
  { label: "travel:", insert: "travel: " },
  { label: "activity:", insert: "activity: " },
  { label: "note:", insert: "note: " },
  { label: "coords:", insert: "coords: " },
];

const MODES: Suggestion[] = TRANSPORT_MODES.map((m) => ({ label: m, insert: m }));

function filterByPrefix(pool: Suggestion[], token: string): Suggestion[] {
  const t = token.toLowerCase();
  return pool.filter((s) => s.label.toLowerCase().startsWith(t));
}

/** The block an indented field line belongs to: the nearest header above it. */
function enclosingBlock(value: string, caret: number): "hop" | "drive" | "top" {
  const lines = value.slice(0, caret).split("\n");
  for (let i = lines.length - 2; i >= 0; i--) {
    const ln = lines[i];
    if (ln.trim() === "" || /^\s/.test(ln)) continue; // blank or indented field
    if (/^drive\b/i.test(ln)) return "drive";
    if (/^hop\b/i.test(ln)) return "hop";
    return "top";
  }
  return "top";
}

/**
 * Work out what to suggest given the full text and caret offset. Returns null
 * when the caret isn't in a completable position (so the popup should close).
 *
 * Three contexts are recognized, all based on the current line up to the caret:
 *   - `arrive_by:`/`by:` value position  → transport modes
 *   - an indented partial word           → hop fields
 *   - a top-level partial word           → top-level directives
 */
export function getCompletionContext(value: string, caret: number): CompletionContext | null {
  const lineStart = value.lastIndexOf("\n", caret - 1) + 1;
  const before = value.slice(lineStart, caret);

  // Value position after a transport-mode key (token may be empty).
  const modeMatch = before.match(/^\s*(?:arrive_by|by)\s*:\s*([a-z]*)$/i);
  if (modeMatch) {
    const token = modeMatch[1];
    const items = filterByPrefix(MODES, token);
    return items.length ? { token, start: caret - token.length, items } : null;
  }

  // Key position: optional indent followed by a partial identifier and nothing else.
  const keyMatch = before.match(/^(\s*)([a-z_]+)$/i);
  if (keyMatch) {
    const [, indent, token] = keyMatch;
    let pool = TOP_LEVEL;
    if (indent.length > 0) {
      pool = enclosingBlock(value, caret) === "drive" ? DRIVE_FIELDS : HOP_FIELDS;
    }
    const items = filterByPrefix(pool, token);
    return items.length ? { token, start: caret - token.length, items } : null;
  }

  return null;
}
