---
name: rejs-packaging
description: rejs build output, external origins for CSP, and container design decisions for GHCR packaging
metadata:
  type: project
---

rejs is a backend-free static SPA (React 18 + TS, Vite 5). `npm run build` = `tsc -b && vite build` -> `dist/` (no `outDir` override). No `base` set in vite.config.ts, so it serves at subdomain ROOT with absolute `/assets/` paths — correct for `rejs.lillevang.dev`, would break on a subpath.

**External origins (for CSP):**

- Map tiles: `https://server.arcgisonline.com` (Esri/ArcGIS World_Street_Map), set in `src/components/MapView.tsx` (no `{s}` subdomains). -> needs `img-src`.
- Geocoding: `https://nominatim.openstreetmap.org` in `src/geocode/nominatim.ts`. -> needs `connect-src`.
- Leaflet sets inline styles at runtime -> CSP `style-src` MUST include `'unsafe-inline'`.

**Container design (files at repo root: Dockerfile, nginx.conf, security-headers.inc, .version, Taskfile.yaml, .github/workflows/container.yaml):**

- Image name: `ghcr.io/lillevang/rejs` (matches operator convention [[infra-conventions]]).
- Builder: `node:22.12.0-alpine` (Node 22 Active LTS; rejs uses @types/node 22). Pasted-in original used `node:26.3.1` — rejected as not a real LTS.
- Runtime: `nginxinc/nginx-unprivileged:1.27-alpine`, listens 8080, runs UID 101. Chosen over hand-rolled non-root nginx (the website app's pattern) because the unprivileged image removes the manual user/pid/cache chown boilerplate. Matches website's 8080 + non-root posture, which suits a k8s Service targetPort 8080.
- `SITE_VERSION` build-arg accepted for tooling parity but NOT consumed by the Vite build (no env wiring). Kept harmless/optional.
- nginx: SPA fallback to index.html, `/healthz` -> `ok` (Taskfile + k8s probe), immutable cache for `/assets/`, no-cache for index.html.
- `.version` seeded `0.1.0` to match package.json version; Taskfile `bump` advances it.

**Decisions / done:** Authored deploy artifacts only; no app code touched, so `check.sh` done-gate does not apply. Did NOT commit/push (per request + CLAUDE.md).

**Open questions for operator:** (1) confirm `rejs.lillevang.dev` added to cert `lillevang-tls` dnsNames; (2) confirm DNS for the subdomain; (3) confirm whether a dedicated `deploy/` dir is preferred over repo-root placement (pasted files were at root, so kept there).
