// Share links: encode the DSL into a URL hash so a journey can be shared with a
// single link, no backend. The link is self-contained and editable on open —
// the recipient gets the DSL loaded into their own (local) editor.

const HASH_PREFIX = "plan=";

// base64url of the UTF-8 bytes: URL-hash safe (no +, /, or = to be re-encoded).
function toBase64Url(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(token: string): string {
  const binary = atob(token.replace(/-/g, "+").replace(/_/g, "/"));
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

/** The `#plan=…` hash fragment carrying a DSL payload. */
export function encodePlanHash(dsl: string): string {
  return `#${HASH_PREFIX}${toBase64Url(dsl)}`;
}

/**
 * Extract a shared DSL from a URL hash. Returns null when the hash carries no
 * plan token or the token is malformed, so the app falls back to its normal
 * load path rather than throwing on a hand-mangled link.
 */
export function decodePlanHash(hash: string): string | null {
  const raw = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!raw.startsWith(HASH_PREFIX)) return null;
  const token = raw.slice(HASH_PREFIX.length);
  if (!token) return null;
  try {
    return fromBase64Url(token);
  } catch {
    return null;
  }
}

/** A full, self-contained share URL: current origin+path with the plan in the hash. */
export function buildShareUrl(dsl: string): string {
  const { origin, pathname } = globalThis.location;
  return `${origin}${pathname}${encodePlanHash(dsl)}`;
}
