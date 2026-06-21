# syntax=docker/dockerfile:1

# --- Build stage -------------------------------------------------------------
# Pinned Node 22 LTS (Active LTS) on Alpine for a small, reproducible builder.
FROM node:22.12.0-alpine AS builder

# SITE_VERSION is accepted for parity with the release tooling (Taskfile / CI).
# The Vite build does not currently consume it, but it is exported as an env var
# so it is available to the build if wiring is added later.
ARG SITE_VERSION=dev
ENV SITE_VERSION=${SITE_VERSION}

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
FROM nginxinc/nginx-unprivileged:1.27-alpine

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
