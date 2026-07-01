// Share links: encode the DSL into a URL hash so a journey can be shared with a
// single link, no backend. The link is self-contained and editable on open —
// the recipient gets the DSL loaded into their own (local) editor.
//
// An optional short-link slug rides in the same fragment as `&s=<slug>`. When a
// journey is shared through the url-shortener, the redirect target embeds its
// slug here so that any browser opening the short link learns which slug to
// update on its next edit — keeping the short link stable while its long target
// changes. See `short-link.ts` / `share-link.ts`.

const HASH_PREFIX = "plan=";
const SLUG_PREFIX = "s=";

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

/**
 * The `#plan=…` hash fragment carrying a DSL payload, plus an optional `&s=…`
 * short-link slug. The plan token is base64url (no `&`), so the two parts split
 * cleanly on `&`.
 */
export function encodePlanHash(dsl: string, slug?: string | null): string {
  const base = `#${HASH_PREFIX}${toBase64Url(dsl)}`;
  return slug ? `${base}&${SLUG_PREFIX}${encodeURIComponent(slug)}` : base;
}

// Split a fragment into its plan token and optional slug, or null when it
// carries no plan token at all.
function splitHash(hash: string): { token: string; slug: string | null } | null {
  const raw = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!raw.startsWith(HASH_PREFIX)) return null;
  const [token, ...rest] = raw.slice(HASH_PREFIX.length).split("&");
  let slug: string | null = null;
  for (const part of rest) {
    if (part.startsWith(SLUG_PREFIX)) {
      slug = decodeURIComponent(part.slice(SLUG_PREFIX.length)) || null;
    }
  }
  return { token, slug };
}

/**
 * Extract a shared DSL from a URL hash. Returns null when the hash carries no
 * plan token or the token is malformed, so the app falls back to its normal
 * load path rather than throwing on a hand-mangled link.
 */
export function decodePlanHash(hash: string): string | null {
  const parts = splitHash(hash);
  if (!parts || !parts.token) return null;
  try {
    return fromBase64Url(parts.token);
  } catch {
    return null;
  }
}

/**
 * Extract the short-link slug from a share hash, or null when absent. Lets a
 * browser that opened a short link know which slug to update when the plan is
 * edited and re-shared.
 */
export function decodeShareSlug(hash: string): string | null {
  return splitHash(hash)?.slug ?? null;
}

/** A full, self-contained share URL: current origin+path with the plan (and
 * optional slug) in the hash. */
export function buildShareUrl(dsl: string, slug?: string | null): string {
  const { origin, pathname } = globalThis.location;
  return `${origin}${pathname}${encodePlanHash(dsl, slug)}`;
}
