# Share links

A rejs plan can be shared with a single URL. Sharing is **backend-free by
default**: the whole plan is encoded into the URL hash, so the link is
self-contained and needs no server. An optional **url-shortener integration**
turns that long link into a short, stable one — but if the shortener is
unavailable, rejs always falls back to the long link, so sharing never breaks.

## The self-contained link

"Copy share link" (toolbar) produces a URL of the form:

```
https://rejs.lillevang.dev/#plan=<base64url(dsl)>[&s=<slug>]
```

- `#plan=<token>` — the DSL, encoded as **base64url of its UTF-8 bytes** (URL-hash
  safe: no `+`, `/`, or `=` padding). Implemented in `src/lib/share.ts`
  (`encodePlanHash` / `decodePlanHash`).
- `&s=<slug>` — optional short-link slug (see below). Absent for a plain link.

Because the plan lives in the **fragment** (`#…`), it never reaches any server
and is preserved across HTTP redirects. On open, `App.tsx` decodes the hash into
the editor (a shared plan wins over the autosaved buffer on first load), then
strips the hash so a later reload restores the user's own edits.

Nothing leaves the browser to share a link — only the recipient's later
geocoding lookups hit Nominatim.

## The url-shortener integration

When configured, rejs mints a short link via the
[url-shortener service](https://github.com/lillevang/url-shortener) (public host
`s.lvang.dev`) so a journey gets a short, memorable URL that stays stable while
the plan behind it changes.

### Flow

1. **First share** (`src/lib/share-link.ts` → `makeShareLink`): `POST /` with the
   long link as `target`, receive `{ slug, short_url }`, then `PUT /{slug}` with
   the target rewritten to embed `&s=<slug>`. Share `https://s.lvang.dev/<slug>`.
2. **Open a short link**: `GET /{slug}` `302`-redirects to the long target
   (fragment intact). rejs reads `&s=<slug>` from the hash and remembers the slug.
3. **Edit and re-share**: because rejs knows the slug, it `PUT /{slug}`s the
   updated plan — **the short link stays the same, its target changes**. This
   works for anyone who opened the short link, since the slug travels in the
   fragment.

The slug is reset when a _different_ plan is loaded (Load / Load example), so a
re-share mints a fresh link rather than overwriting an unrelated one.

### Failsafe

Every shortener call fails soft (`src/lib/short-link.ts`): a disabled
integration, network error, 4s timeout, CORS block, or non-2xx response all
resolve to `null`, and `makeShareLink` returns the long self-contained link
instead. Sharing is never blocked by the shortener being down.

### Configuration

| Where                              | Setting                             | Effect                                                                                                                                                                         |
| ---------------------------------- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Build (`VITE_SHORTENER_URL`)       | e.g. `https://s.lvang.dev`          | Enables the integration. **Unset = disabled**, long links only. Vite inlines it at build time; the `Dockerfile` exposes it as an `ARG`. See [`.env.example`](../.env.example). |
| nginx CSP (`security-headers.inc`) | `connect-src … https://s.lvang.dev` | The browser must be allowed to `fetch()` the shortener origin, or the request is blocked by CSP before it leaves the page. Must match `VITE_SHORTENER_URL`.                    |

### Service-side dependencies

For the browser flow to work, the shortener deployment must:

- **Allow CORS** from rejs's origin (preflight `OPTIONS` + `Access-Control-Allow-Origin`)
  on the write routes — tracked in [`lillevang/url-shortener#6`](https://github.com/lillevang/url-shortener/issues/6).
- **Accept public writes** (no per-caller auth), guarded by the target-domain allowlist.
- **Allow rejs's target host** via `TARGET_DOMAIN_ALLOWLIST=*.lillevang.dev` — the
  wildcard is required, since a bare `lillevang.dev` is an exact match and would
  reject `rejs.lillevang.dev`. Deploy tracked in
  [`lillevang/infra#3`](https://github.com/lillevang/infra/issues/3).

Until those land, rejs simply emits the long link.

## Code map

| File                         | Role                                                                     |
| ---------------------------- | ------------------------------------------------------------------------ |
| `src/lib/share.ts`           | Encode/decode the `#plan=…&s=…` hash; build the long URL.                |
| `src/lib/short-link.ts`      | Fail-soft HTTP client for the shortener (`POST /`, `PUT /{slug}`).       |
| `src/lib/share-link.ts`      | Coordinator: mint+embed / update / failsafe (`makeShareLink`).           |
| `src/App.tsx`                | Slug state (learn from `&s=`, reset on plan load); async share callback. |
| `src/components/Toolbar.tsx` | "Copy share link" — awaits the share URL, copies to clipboard.           |
