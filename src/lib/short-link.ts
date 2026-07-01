// Client for the url-shortener service (e.g. https://s.lvang.dev). Turns a
// long, self-contained rejs share URL into a short, stable link.
//
// Every call fails soft: a disabled integration, network error, timeout, CORS
// block, or non-2xx response all resolve to null so the caller can fall back to
// the long link. Sharing must never break because the shortener is down.
//
// The service contract (see the url-shortener repo):
//   POST /            { target, ttl_seconds? } -> 201 { slug, short_url }
//   PUT  /{slug}      { target, ttl_seconds? } -> 200 { slug, short_url }, 404 if unknown
// The write routes only accept targets on our own domains, so `target` is always
// a rejs URL built by `buildShareUrl`.

const REQUEST_TIMEOUT_MS = 4000;

export interface ShortLink {
  slug: string;
  shortUrl: string;
}

// Read lazily (not a module constant) so tests can toggle the env var and so a
// build-time-inlined value is picked up wherever the module is used.
function baseUrl(): string {
  return (import.meta.env.VITE_SHORTENER_URL ?? "").replace(/\/+$/, "");
}

/** Whether a shortener base URL is configured. When false, callers emit the long link. */
export function shortenerEnabled(): boolean {
  return baseUrl() !== "";
}

interface ShortenResponse {
  slug: string;
  short_url: string;
}

async function writeLink(
  method: "POST" | "PUT",
  path: string,
  target: string,
): Promise<ShortLink | null> {
  const base = baseUrl();
  if (base === "") return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(`${base}${path}`, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ target }),
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const body = (await res.json()) as Partial<ShortenResponse>;
    if (!body.slug || !body.short_url) return null;
    return { slug: body.slug, shortUrl: body.short_url };
  } catch {
    // Network failure, timeout (abort), CORS block, or malformed JSON.
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

/** Mint a new short link pointing at `target`. Returns null on any failure. */
export function createShortLink(target: string): Promise<ShortLink | null> {
  return writeLink("POST", "/", target);
}

/** Repoint an existing `slug` at `target`, keeping the short link stable. */
export function updateShortLink(slug: string, target: string): Promise<ShortLink | null> {
  return writeLink("PUT", `/${encodeURIComponent(slug)}`, target);
}
