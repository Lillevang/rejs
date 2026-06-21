---
name: infra-conventions
description: Operator's GitOps/ArgoCD conventions in /workspaces/infra for the lillevang.dev k8s cluster (read-only context)
metadata:
  type: reference
---

Observed in `/workspaces/infra` (READ-ONLY; never edit). Repo: https://github.com/lillevang/infra.git, branch `main`.

**App-of-apps:** `argocd/root-app.yaml` is an ArgoCD Application that recurses `argocd/` (`directory.recurse: true`). Each app gets one Application manifest in `argocd/<name>.yaml` pointing `source.path` at `apps/<name>`. Convention per app Application: `project: default`, `destination.namespace: web`, annotation `argocd.argoproj.io/sync-wave: "40"`, `syncPolicy.automated {prune, selfHeal}`, `syncOptions: [CreateNamespace=true]`.

**App manifests** live in `apps/<name>/`: `deploy.yaml` (Deployment + Service), `httproute.yaml`, `kustomization.yaml` (namespace `web`, lists the two resources).

**Image registry:** `ghcr.io/lillevang/<app>:<tag>`. Deployments use `imagePullSecrets: [{name: ghcr-secret}]` (pre-existing in `web` ns). Service: port 80 -> targetPort 8080 (website) or named `http` port (timeline). website runs non-root nginx on 8080; timeline runs nginx on 80.

**Ingress = Cilium Gateway API** (not nginx-ingress/Traefik). Shared `Gateway` `main-gateway` in `kube-system`, gatewayClass `cilium`. Apps attach via `HTTPRoute` with `parentRefs -> name: main-gateway, namespace: kube-system, sectionName: <listener>`. Subdomains use listener `https-lillevang` (hostname `*.lillevang.dev`); root `lillevang.dev` uses `https-lillevang-root`. HTTP->HTTPS 301 redirect handled globally.

**TLS = cert-manager**, ClusterIssuer `letsencrypt`. Certificates defined in `apps/gateway/certificates.yaml`. IMPORTANT: `lillevang-tls` (secret `lillevang-tls`, ns kube-system) has an EXPLICIT `dnsNames` list (timeline/dropzone/iam). A new subdomain like `rejs.lillevang.dev` must be ADDED to that dnsNames list — the wildcard listener serves it but the cert is SAN-pinned. This is an operator manual step in the infra repo.

**DNS:** `*.lillevang.dev` wildcard handling not directly visible in infra repo files read; treat per-subdomain DNS as an open question to confirm with operator (likely wildcard A/CNAME to the gateway LB).

**Closest analog for a new subdomain SPA = `timeline`** (HTTPRoute on `https-lillevang`, Deployment+Service, static site). Re-verified 2026-06-20: `apps/timeline/{deploy,httproute,kustomization}.yaml` + `argocd/timeline.yaml`. Service style: `port 80 -> targetPort: http` (named). For probes/securityContext on a `/healthz`+8080 image, `dropzone` is the closer model (uses `/healthz` on named `http` port 8080, `securityContext runAsNonRoot/runAsUser`). NOTE: no sibling Deployment sets `resources` — adding them is an improvement, not a convention. Gateway `https-lillevang` listener hostname is already `*.lillevang.dev`, so a new subdomain needs NO gateway/listener edit — only the `lillevang-tls` Certificate `dnsNames` (currently timeline/dropzone/iam) addition in `apps/gateway/certificates.yaml`.

**rejs onboarding runbook authored** at `/workspaces/rejs/docs/deploy/infra-onboarding.md` (full copy-paste YAML for `apps/rejs/` + `argocd/rejs.yaml` + cert SAN edit). Operator still must (not yet done in infra repo): confirm DNS, GHCR pull access, then create the files & push to main.
