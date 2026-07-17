# Container image

rejs ships as a static SPA served by nginx. This doc covers how the image is
built and configured; for deploying it to the cluster see
[`infra-onboarding.md`](./infra-onboarding.md).

## Build

`Dockerfile` is a two-stage build:

1. **Builder** (`node:22-alpine`) — `npm ci` against the committed lockfile, then
   `npm run build` (`tsc -b && vite build`) → `/app/dist`.
2. **Runtime** (`nginxinc/nginx-unprivileged:1.27-alpine`) — copies `dist/` to
   `/usr/share/nginx/html` and the nginx config in. No Node runtime, no secrets;
   fully static and stateless. Runs as the unprivileged `nginx` user (UID 101),
   listens on **8080**.

### Build args

| Arg                  | Purpose                                                                                                                                                                                                                      |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `SITE_VERSION`       | Version label, exported to the build env (accepted for parity with release tooling).                                                                                                                                         |
| `VITE_SHORTENER_URL` | Base URL of the url-shortener (e.g. `https://s.lvang.dev`). Vite inlines `VITE_*` at build time, so it must be set at **build**, not runtime. Empty = the [share-link](../share-links.md) shortener integration is disabled. |

## nginx config

`nginx.conf` (copied to `/etc/nginx/conf.d/default.conf`, so it sits inside the
`http` block and can carry http-level directives) follows the same hardened
pattern as the sibling static sites (website, timeline):

- Listens on **8080** (IPv4 + IPv6); an unprivileged user can't bind 80.
- **Default server** (`server_name _`): any request whose Host doesn't match
  `rejs.lillevang.dev` gets `444` (connection dropped, no response). Only
  `location = /healthz` → `200 'ok'` lives there too, because k8s probes and
  the Taskfile healthcheck reach the container by pod IP / localhost. This
  means local smoke tests against `localhost` only get `/healthz` — use a
  `Host: rejs.lillevang.dev` header to exercise the app vhost.
- **Real client IP** recovered from `X-Forwarded-For` (`set_real_ip_from` the
  Cilium gateway pod network and the Hetzner LB). ⚠️ Those two values are
  **copied from the infra repo** (cluster pod CIDR, LB IP); if either changes
  there, update `nginx.conf` too. Drift is silent: real_ip stops resolving, all
  visitors share the gateway's rate-limit bucket, and the site throws
  widespread `429`s with nothing in the nginx error log.
- **Per-IP rate limit**: 10 r/s sustained, burst 30, `429` on excess — applied
  to the app locations (`/`, `/index.html`, unknown paths), not `/healthz` or
  hashed assets.
- `location /assets/` → long-lived immutable caching (Vite emits hashed filenames).
- `index.html` (and `/`, which serves it) is `no-cache` so new deploys are
  picked up immediately.
- **No SPA fallback**: the app is a single page at `/`; shared plans travel in
  the URL fragment and never reach the server (see
  [share-links.md](../share-links.md)). Unknown paths return a real **404**,
  and directory URIs aren't resolved (no `403` hinting that `/assets/` exists).
- The app locations `include /etc/nginx/conf.d/security-headers.inc`.

## Security headers (`security-headers.inc`)

Baseline headers plus a **Content-Security-Policy** tuned for this app:

- `default-src 'self'`; `script-src 'self'`.
- `style-src 'self' 'unsafe-inline'` — Leaflet sets inline styles on map panes/
  markers at runtime and cannot function without it.
- `img-src 'self' data: blob: https://server.arcgisonline.com` — Esri/ArcGIS map
  tiles + bundled Leaflet marker icons.
- `connect-src 'self' https://nominatim.openstreetmap.org https://s.lvang.dev` —
  the Nominatim geocoder and the url-shortener. **The shortener origin here must
  match `VITE_SHORTENER_URL`**, or the browser blocks the mint request via CSP.

### ⚠️ Gotcha: keep `security-headers.inc` out of Prettier

Prettier infers an `.inc` file as **HTML** and reflows it, which collapses the
line-based `#` comments and `add_header` directives into invalid config — nginx
then fails to start with `unknown directive`. The file is listed in
`.prettierignore` for exactly this reason; **do not remove it**, and hand-format
the file (one directive per line).

## Publish

Releases are cut **locally** with `task release` — there is no CI image build.
The cluster's Kyverno `verify-image-signatures` policy requires every
`ghcr.io/lillevang/*` image to carry a cosign signature, and the signing key
lives only in 1Password (no CI secrets), so the Taskfile is the only path that
publishes a signed image. See infra `docs/kyverno.md` (Phase 3).

`task release` runs: build → healthcheck → push → **sign** → verify-signature →
Trivy SBOM/vuln scan → commit artifacts. Then bump the tag in the infra repo
(`apps/rejs/deploy.yaml`) to deploy via ArgoCD.

The build passes `VITE_SHORTENER_URL=https://s.lvang.dev` as a build arg, so the
published image has the shortener integration **enabled**; keep that value in
sync with the CSP `connect-src` host in `security-headers.inc`.

### Signing prerequisites

- **1Password session live** — `op read` needs one; a stale session makes cosign
  fail with a misleading `invalid pem block`.
- **Logged in to GHCR with podman** —
  `gh auth token | podman login ghcr.io -u Lillevang --password-stdin`.
  The `sign`/`verify-signature` tasks copy podman's `containers/auth.json` into a
  throwaway `DOCKER_CONFIG` for cosign, which only reads docker-style config.

The three cosign flags in the `sign` task
(`--new-bundle-format=false --use-signing-config=false --tlog-upload=false`) are
**load-bearing**: cosign v3 defaults to the sigstore bundle format, which Kyverno
1.18 cannot verify key-based. Don't drop them without re-testing verification.

## Config summary

| Setting              | Where                  | Notes                                                       |
| -------------------- | ---------------------- | ----------------------------------------------------------- |
| `VITE_SHORTENER_URL` | build arg              | Enables short links; must match the CSP `connect-src` host. |
| CSP `connect-src`    | `security-headers.inc` | Must list the geocoder and shortener origins.               |
| Listen port          | `nginx.conf`           | 8080 (non-root).                                            |
| Health               | `nginx.conf`           | `GET /healthz` → `ok` (any Host).                           |
| Vhost                | `nginx.conf`           | `rejs.lillevang.dev`; other Hosts get `444`.                |
| Rate limit           | `nginx.conf`           | 10 r/s per client IP, burst 30, `429` on excess.            |
