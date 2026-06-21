// Pure DSL-text edits driven by direct manipulation in the views.
//
// The DSL text is the single source of truth, so placing a pin (drag, map
// click, or disambiguation pick) is just a text edit: set or insert a `coords:`
// line on the hop whose header is at a known source line. Keeping this pure and
// text-based means the change round-trips back through parse → resolve → render
// like any keystroke, and shows up in the editor and autosave for free.

/** Round a coordinate to ~1m precision, matching the tidy style in example.ts. */
function roundCoord(n: number): number {
  return Math.round(n * 1e5) / 1e5;
}

/** Format a lat/lng pair exactly as the parser expects: `lat, lng`. */
export function formatCoords(lat: number, lng: number): string {
  return `${roundCoord(lat)}, ${roundCoord(lng)}`;
}

/** A line that starts a new block, ending the current hop's body. */
function isBlockBoundary(line: string): boolean {
  const trimmed = line.trim();
  if (trimmed === "") return false; // blank lines stay inside the block
  // No leading indent means a new top-level construct (hop/drive/start/etc.).
  return !/^\s/.test(line);
}

/**
 * Set the `coords:` of the hop whose header is on `headerLine` (1-based) to the
 * given lat/lng, returning the new DSL text. If the hop already has a `coords:`
 * line, it's replaced in place (preserving its indentation); otherwise a new
 * `coords:` line is inserted right after the header, indented to match the hop's
 * existing body (or two spaces by default).
 *
 * Other lines and fields are never touched. If `headerLine` doesn't point at a
 * line, the text is returned unchanged.
 */
export function setHopCoords(text: string, headerLine: number, lat: number, lng: number): string {
  const lines = text.split("\n");
  const headerIdx = headerLine - 1;
  if (headerIdx < 0 || headerIdx >= lines.length) return text;

  const value = formatCoords(lat, lng);

  // Find the hop body: lines after the header up to (but not including) the
  // next block boundary.
  let bodyEnd = headerIdx + 1;
  while (bodyEnd < lines.length && !isBlockBoundary(lines[bodyEnd])) bodyEnd++;

  // Replace an existing `coords:` line within the body if present.
  for (let i = headerIdx + 1; i < bodyEnd; i++) {
    const m = lines[i].match(/^(\s*)coords\s*:/i);
    if (m) {
      lines[i] = `${m[1]}coords: ${value}`;
      return lines.join("\n");
    }
  }

  // Otherwise insert a new coords line after the header, matching the body's
  // indentation (fall back to two spaces, the convention everywhere else).
  let indent = "  ";
  for (let i = headerIdx + 1; i < bodyEnd; i++) {
    const m = lines[i].match(/^(\s+)\S/);
    if (m) {
      indent = m[1];
      break;
    }
  }
  lines.splice(headerIdx + 1, 0, `${indent}coords: ${value}`);
  return lines.join("\n");
}

/** Placeholder name a quick-added hop gets until the user renames it. */
export const NEW_HOP_NAME = "New stop";

/** The DSL block `appendHop` writes (header + a sensible default body). */
const NEW_HOP_BLOCK = `hop ${NEW_HOP_NAME}:\n  stay: 2d\n`;

/**
 * Append a correctly-formed hop block to the DSL so a newcomer can add a stop
 * without knowing the syntax. Returns the new full text plus the character
 * offsets of the placeholder name in the generated header, so the UI can select
 * it for immediate renaming.
 *
 * The block is separated from any preceding content by exactly one blank line,
 * matching how hops are spaced in the seed example. Duplicate placeholder names
 * are left as-is: the DSL allows repeated hop names (each parses to its own hop),
 * so disambiguating would add complexity for no benefit.
 */
export function appendHop(text: string): { text: string; nameStart: number; nameEnd: number } {
  // Trim only trailing whitespace so we control the exact separator, then add a
  // blank line before the new block when there's prior content to separate from.
  const base = text.replace(/\s+$/, "");
  const separator = base === "" ? "" : "\n\n";
  const prefix = base + separator;
  const next = prefix + NEW_HOP_BLOCK;

  // The placeholder name sits right after the `hop ` keyword in the new block.
  const nameStart = prefix.length + "hop ".length;
  const nameEnd = nameStart + NEW_HOP_NAME.length;
  return { text: next, nameStart, nameEnd };
}
