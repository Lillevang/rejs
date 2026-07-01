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

| Arg                  | Purpose                                                                                                                                                                                                                       |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `SITE_VERSION`       | Version label, exported to the build env (accepted for parity with release tooling).                                                                                                                                          |
| `VITE_SHORTENER_URL` | Base URL of the url-shortener (e.g. `https://s.jlvang.dev`). Vite inlines `VITE_*` at build time, so it must be set at **build**, not runtime. Empty = the [share-link](../share-links.md) shortener integration is disabled. |

## nginx config

`nginx.conf` (copied to `/etc/nginx/conf.d/default.conf`) serves the SPA:

- Listens on **8080** (IPv4 + IPv6); an unprivileged user can't bind 80.
- `location = /healthz` → `200 'ok'` — used by the k8s probes and the Taskfile healthcheck.
- `location /assets/` → long-lived immutable caching (Vite emits hashed filenames).
- `index.html` is served `no-cache` so new deploys are picked up immediately.
- SPA fallback: unknown paths `try_files … /index.html` (client-side routing).
- The SPA locations `include /etc/nginx/conf.d/security-headers.inc`.

## Security headers (`security-headers.inc`)

Baseline headers plus a **Content-Security-Policy** tuned for this app:

- `default-src 'self'`; `script-src 'self'`.
- `style-src 'self' 'unsafe-inline'` — Leaflet sets inline styles on map panes/
  markers at runtime and cannot function without it.
- `img-src 'self' data: blob: https://server.arcgisonline.com` — Esri/ArcGIS map
  tiles + bundled Leaflet marker icons.
- `connect-src 'self' https://nominatim.openstreetmap.org https://s.jlvang.dev` —
  the Nominatim geocoder and the url-shortener. **The shortener origin here must
  match `VITE_SHORTENER_URL`**, or the browser blocks the mint request via CSP.

### ⚠️ Gotcha: keep `security-headers.inc` out of Prettier

Prettier infers an `.inc` file as **HTML** and reflows it, which collapses the
line-based `#` comments and `add_header` directives into invalid config — nginx
then fails to start with `unknown directive`. The file is listed in
`.prettierignore` for exactly this reason; **do not remove it**, and hand-format
the file (one directive per line).

## Publish

A GitHub Actions workflow builds and pushes `ghcr.io/lillevang/rejs` on push to
`main` and on `v*` tags (multi-arch). A `Taskfile.yaml` (`task build` /
`task verify` / `task release`) packages and publishes locally.

## Config summary

| Setting              | Where                  | Notes                                                       |
| -------------------- | ---------------------- | ----------------------------------------------------------- |
| `VITE_SHORTENER_URL` | build arg              | Enables short links; must match the CSP `connect-src` host. |
| CSP `connect-src`    | `security-headers.inc` | Must list the geocoder and shortener origins.               |
| Listen port          | `nginx.conf`           | 8080 (non-root).                                            |
| Health               | `nginx.conf`           | `GET /healthz` → `ok`.                                      |
