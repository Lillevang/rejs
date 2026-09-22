# syntax=docker/dockerfile:1@sha256:ecfaec9ed6d810b56388c508f4121597bfbba70d41a6dfeee4d8cad5f295fc32

# --- Build stage -------------------------------------------------------------
# Pinned Node 24 LTS (Active LTS) on Alpine for a small, reproducible builder.
FROM node:24.21.0-alpine@sha256:ebfe2f90462722a7a4de65e91990e97fe0d401c70e0e762c5b53302f905ec1c1 AS builder

# SITE_VERSION is accepted for parity with the release tooling (Taskfile / CI).
# The Vite build does not currently consume it, but it is exported as an env var
# so it is available to the build if wiring is added later.
ARG SITE_VERSION=dev
ENV SITE_VERSION=${SITE_VERSION}

# Base URL of the url-shortener service (e.g. https://s.lvang.dev). Vite inlines
# VITE_* vars at build time, so this must be present for `npm run build`. Empty
# (the default) disables the shortener and share links stay long/self-contained.
ARG VITE_SHORTENER_URL=
ENV VITE_SHORTENER_URL=${VITE_SHORTENER_URL}

WORKDIR /app

# Install dependencies against the committed lockfile for reproducible builds.
COPY package*.json ./
RUN npm ci

# Build the static SPA (tsc -b && vite build -> /app/dist).
COPY . .
RUN npm run build

# --- Runtime stage -----------------------------------------------------------
# Minimal, unprivileged nginx that serves the static bundle. No Node runtime,
# no app secrets, fully static and stateless.
FROM nginxinc/nginx-unprivileged:1.31-alpine@sha256:e75f89810bf5bfbcf58a1cfb32a1a11de55b7623d732e67735d513b720d7436a

# nginx-unprivileged already runs as UID 101 (nginx) and listens unprivileged,
# so no manual user creation or pid/cache chown juggling is required.
USER root
RUN apk upgrade --no-cache
USER nginx

# Serve config: listens on 8080, SPA fallback, /healthz, cache + security headers.
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY security-headers.inc /etc/nginx/conf.d/security-headers.inc

# Static assets produced by the build stage.
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 8080

CMD ["nginx", "-g", "daemon off;"]
