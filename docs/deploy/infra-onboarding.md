# Onboarding rejs into the infra GitOps repo

Runbook for deploying **rejs** to **`rejs.lillevang.dev`** via the ArgoCD app-of-apps
in [`github.com/lillevang/infra`](https://github.com/lillevang/infra).

- **Image:** `ghcr.io/lillevang/rejs`
- **Hostname:** `rejs.lillevang.dev`
- **Container:** static SPA on non-root nginx, listens **8080**, health endpoint **`/healthz`** -> `ok`
- **Mirrored app:** **timeline** (closest subdomain analog: `*.lillevang.dev` HTTPRoute via the
  `https-lillevang` listener, static site, ArgoCD Application, namespace `web`). The Deployment's
  probe + securityContext shape is taken from **dropzone**, which already uses `/healthz` on a named
  `http` port at 8080 — matching rejs exactly.

> **You cannot edit anything in this runbook's repo into `/workspaces/infra` automatically.** Every
> step below is a manual change the operator makes in the **infra** repo and pushes to `main`.
> ArgoCD auto-syncs `main` (`prune: true`, `selfHeal: true`), so **commit + push to `main` = deploy**.

---

## 0. Conventions confirmed from `/workspaces/infra` (read 2026-06-20)

| Concern            | Convention (observed)                                                                                               |
| ------------------ | ------------------------------------------------------------------------------------------------------------------- |
| App-of-apps        | `argocd/root-app.yaml` recurses `argocd/` (`directory.recurse: true`); one `argocd/<name>.yaml` Application per app |
| App manifests      | `apps/<name>/` with `kustomization.yaml`, `deploy.yaml` (Deployment + Service), `httproute.yaml`                    |
| Namespace          | `web` (set in kustomization + Application destination; `CreateNamespace=true`)                                      |
| Sync-wave          | Applications run at wave `40` (annotation `argocd.argoproj.io/sync-wave: "40"`)                                     |
| Sync policy        | `automated { prune: true, selfHeal: true }`, `syncOptions: [CreateNamespace=true]`                                  |
| Registry           | `ghcr.io/lillevang/<app>:<tag>`; `imagePullSecrets: [{ name: ghcr-secret }]` (pre-existing in `web`)                |
| Ingress            | Cilium Gateway API; shared `Gateway` `main-gateway` in `kube-system`, gatewayClass `cilium`                         |
| Subdomain listener | `sectionName: https-lillevang` (hostname `*.lillevang.dev`). Root uses `https-lillevang-root`                       |
| TLS                | cert-manager + ClusterIssuer `letsencrypt`; certs in `apps/gateway/certificates.yaml`                               |
| Subdomain cert     | `lillevang-tls` Certificate has an **explicit, SAN-pinned `dnsNames` list** (NOT wildcard)                          |
| Service            | `port: 80 -> targetPort` (timeline uses named `http`; website uses literal `8080`)                                  |
| Deploy step        | No manual `kubectl apply`; **push to `main`**, ArgoCD syncs                                                         |

---

## 1. Prerequisites

- [ ] **Image published to GHCR and pullable.** `.github/workflows/container.yaml` in the rejs repo
      builds + pushes `ghcr.io/lillevang/rejs` on push to `main` and on `v*` tags. Confirm the tag you
      intend to deploy actually exists:
      `bash
crane ls ghcr.io/lillevang/rejs        # or: docker buildx imagetools inspect ghcr.io/lillevang/rejs:<tag>
`
- [ ] **Package visibility / pull secret.** All sibling apps reference `imagePullSecrets: [{ name: ghcr-secret }]`,
      which already exists in the `web` namespace. If the `rejs` GHCR package is **private**, no extra work —
      `ghcr-secret` must simply have pull access to it. If you prefer not to rely on the secret, set the GHCR
      package to **public** in the GitHub package settings. (Sibling apps use the secret, so keeping rejs
      consistent and relying on `ghcr-secret` is the recommended path.)
- [ ] **Tag chosen.** rejs `.version` is currently `0.1.0`. Decide the deploy tag (e.g. `0.1.0`, a `v*` tag,
      or — preferred for immutability — a digest, see notes). Fill it into `apps/rejs/deploy.yaml` below.

---

## 2. Files to create in the infra repo

Create directory `apps/rejs/` with the three files below, then the ArgoCD Application.

### 2a. `apps/rejs/deploy.yaml`

Mirrors **timeline** (Deployment + Service, named `http` port, Service `80 -> http`) but uses
rejs's real container port **8080**, the **`/healthz`** probes, and a non-root `securityContext`
(borrowed from dropzone; the rejs image already runs as the unprivileged `nginx` user / UID 101).

```yaml
apiVersion: apps/v1
kind: Deployment
metadata: { name: rejs, namespace: web }
spec:
  replicas: 1
  selector: { matchLabels: { app: rejs } }
  template:
    metadata: { labels: { app: rejs } }
    spec:
      imagePullSecrets:
        - name: ghcr-secret
      securityContext:
        runAsNonRoot: true
        # The nginx-unprivileged base image runs as UID 101. Pin it so the pod
        # is rejected if a future image regresses to root.
        runAsUser: 101
      containers:
        - name: rejs
          # FILL IN: pin to the tag you confirmed in step 1, or (preferred) a digest:
          #   ghcr.io/lillevang/rejs@sha256:<digest>
          image: ghcr.io/lillevang/rejs:0.1.0
          ports:
            - name: http
              containerPort: 8080
          readinessProbe:
            httpGet: { path: /healthz, port: http }
            initialDelaySeconds: 5
            periodSeconds: 10
            timeoutSeconds: 2
            failureThreshold: 3
          livenessProbe:
            httpGet: { path: /healthz, port: http }
            initialDelaySeconds: 15
            periodSeconds: 20
            timeoutSeconds: 2
            failureThreshold: 3
          resources:
            # No sibling sets resources today, so these are conservative defaults
            # for a static nginx SPA. Adjust or delete to match house style.
            requests: { cpu: 10m, memory: 32Mi }
            limits: { cpu: 200m, memory: 128Mi }
---
apiVersion: v1
kind: Service
metadata: { name: rejs, namespace: web }
spec:
  selector:
    app: rejs
  ports:
    - name: http
      port: 80
      targetPort: http
```

> **Note on `resources`:** no sibling Deployment (timeline/website/dropzone) declares `resources`.
> Including them is an **improvement, not a convention** — keep them if you want guardrails, or delete
> the block to match the existing apps exactly. Labeled as an assumption in §9.

> **Note on read-only root FS:** the rejs nginx image writes a PID file and temp/cache paths at runtime,
> so a blanket `readOnlyRootFilesystem: true` is **not** added here (would need tmpfs mounts for
> `/tmp` and nginx cache dirs). Left off to keep parity with siblings and avoid a startup break.

### 2b. `apps/rejs/httproute.yaml`

Mirrors **timeline** exactly — subdomain listener `https-lillevang`, only the name/hostname/backend
change.

```yaml
apiVersion: gateway.networking.k8s.io/v1
kind: HTTPRoute
metadata:
  name: rejs
  namespace: web
spec:
  parentRefs:
    - name: main-gateway
      namespace: kube-system
      sectionName: https-lillevang
  hostnames:
    - "rejs.lillevang.dev"
  rules:
    - matches:
        - path:
            type: PathPrefix
            value: /
      backendRefs:
        - name: rejs
          port: 80
```

### 2c. `apps/rejs/kustomization.yaml`

Identical shape to timeline's.

```yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization
namespace: web
resources:
  - deploy.yaml
  - httproute.yaml
```

### 2d. `argocd/rejs.yaml` (ArgoCD Application)

Mirrors **`argocd/timeline.yaml`**. Picked up automatically by the recursing `root` app — no edit to
`root-app.yaml` needed.

```yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: rejs
  namespace: argocd
  annotations:
    argocd.argoproj.io/sync-wave: "40"
spec:
  project: default
  destination:
    server: https://kubernetes.default.svc
    namespace: web
  source:
    repoURL: https://github.com/lillevang/infra.git
    targetRevision: main
    path: apps/rejs
  syncPolicy:
    automated:
      prune: true
      selfHeal: true
    syncOptions:
      - CreateNamespace=true
```

---

## 3. TLS — add the hostname to the SAN-pinned certificate

The `https-lillevang` gateway listener already serves `*.lillevang.dev`, **but** the certificate it
presents (`lillevang-tls`) has an **explicit `dnsNames` list** — it is SAN-pinned, not a wildcard
cert. `rejs.lillevang.dev` must be added or TLS will fail for the new host.

**File:** `apps/gateway/certificates.yaml`

**Before:**

```yaml
apiVersion: cert-manager.io/v1
kind: Certificate
metadata:
  name: lillevang-tls
  namespace: kube-system
spec:
  secretName: lillevang-tls
  issuerRef:
    name: letsencrypt
    kind: ClusterIssuer
  dnsNames:
    - "timeline.lillevang.dev"
    - "dropzone.lillevang.dev"
    - "iam.lillevang.dev"
```

**After:**

```yaml
apiVersion: cert-manager.io/v1
kind: Certificate
metadata:
  name: lillevang-tls
  namespace: kube-system
spec:
  secretName: lillevang-tls
  issuerRef:
    name: letsencrypt
    kind: ClusterIssuer
  dnsNames:
    - "timeline.lillevang.dev"
    - "dropzone.lillevang.dev"
    - "iam.lillevang.dev"
    - "rejs.lillevang.dev" # added for rejs
```

> **No gateway listener change required.** The `https-lillevang` listener's hostname is already
> `*.lillevang.dev` (verified in `apps/gateway/gateway.yaml`). Only the cert SAN list changes.
> After push, cert-manager re-issues `lillevang-tls` with the new SAN via Let's Encrypt (HTTP-01).

---

## 4. DNS

`rejs.lillevang.dev` must resolve to the cluster gateway's external LB address (the same target the
other `*.lillevang.dev` subdomains use).

- **If a wildcard `*.lillevang.dev` A/CNAME already exists** at the DNS provider, `rejs.lillevang.dev`
  resolves automatically — no DNS change needed.
- **If records are per-subdomain**, add an A (or CNAME) record for `rejs.lillevang.dev` pointing at the
  same address as `timeline.lillevang.dev`.

**Verify:**

```bash
dig +short rejs.lillevang.dev
dig +short timeline.lillevang.dev      # compare — should resolve to the same gateway address
```

> **OPEN ITEM (could not verify from the infra repo):** DNS for `*.lillevang.dev` is **not declared in
> `/workspaces/infra`** (no external-dns manifest, no DNS records in Terraform that were visible). The
> wildcard vs. per-subdomain question must be confirmed at the DNS provider before HTTP-01 issuance
> and routing will work. **Confirm this first** — Let's Encrypt issuance in §3 also depends on the host
> resolving and reaching the gateway.

---

## 5. HTTPRoute / gateway wiring (summary)

Already encoded in `apps/rejs/httproute.yaml` (§2b). The correct wiring for a `*.lillevang.dev`
subdomain is:

- `parentRefs.name: main-gateway`, `namespace: kube-system`
- `sectionName: https-lillevang` ← the `*.lillevang.dev` HTTPS listener (NOT `https-lillevang-root`,
  which is reserved for the apex `lillevang.dev`)
- `hostnames: ["rejs.lillevang.dev"]`
- `backendRefs: name: rejs, port: 80`

The global HTTP->HTTPS 301 redirect (`http-redirect` HTTPRoute in `kube-system`) already covers all
hosts; no per-app redirect needed.

---

## 6. Apply / sync

This repo deploys via GitOps — **there is no manual `kubectl apply` for app changes.**

1. Branch in the **infra** repo, add the files from §2 and the edit from §3.
2. Open a PR (repo convention: changes land on `main`; ArgoCD watches `main`). Commit messages: follow
   the infra repo's own style.
3. Merge to `main`. ArgoCD's `root` app recurses `argocd/`, discovers `argocd/rejs.yaml`, and
   auto-syncs (`prune` + `selfHeal`).
4. (Optional) Force/inspect sync:
   ```bash
   kubectl get applications -n argocd
   argocd app diff rejs
   argocd app sync rejs
   ```

> The cert change in §3 belongs to the already-synced `gateway` app — it syncs on the same push.

---

## 7. Verification

```bash
# Pod is running and ready
kubectl get pods -n web -l app=rejs
kubectl rollout status deploy/rejs -n web

# Health endpoint inside the cluster
kubectl exec -n web deploy/rejs -- wget -qO- http://localhost:8080/healthz   # -> ok

# ArgoCD reports Synced + Healthy
kubectl get application rejs -n argocd

# Certificate includes the new SAN and is Ready
kubectl get certificate lillevang-tls -n kube-system -o jsonpath='{.spec.dnsNames}'; echo
kubectl get certificate lillevang-tls -n kube-system   # READY should be True

# TLS served for the hostname (correct SAN, valid chain)
echo | openssl s_client -connect rejs.lillevang.dev:443 -servername rejs.lillevang.dev 2>/dev/null \
  | openssl x509 -noout -subject -ext subjectAltName

# App loads end-to-end
curl -sI https://rejs.lillevang.dev/healthz      # 200, body "ok"
curl -sI https://rejs.lillevang.dev/             # 200, serves index.html
```

Also load `https://rejs.lillevang.dev/` in a browser and confirm: the map renders (Esri tiles load),
a place search resolves (Nominatim request succeeds), and there are no CSP violations in the console.

---

## 8. Rollback

- **Bad image:** revert the `image:` tag in `apps/rejs/deploy.yaml` to the last-good tag/digest and
  push to `main` (ArgoCD re-syncs). This is the cleanest rollback because deploys are pinned by tag.
- **Bad manifest / full onboarding revert:** `git revert` the onboarding commit(s) on `main`. ArgoCD
  will prune the `rejs` Application and its resources (`prune: true`). The cert SAN can be left in
  place harmlessly, or reverted in the same commit if you want a clean removal.
- **Emergency:** `kubectl rollout undo deploy/rejs -n web` — but note `selfHeal: true` will re-apply
  the Git state, so a manual rollback is only a stopgap until Git is fixed.

---

## 9. Open questions / assumptions — confirm before applying

1. **DNS (BLOCKER).** Whether `*.lillevang.dev` is a wildcard record or per-subdomain is **not derivable
   from the infra repo**. If per-subdomain, you must add `rejs.lillevang.dev` at the DNS provider
   (§4). Let's Encrypt HTTP-01 issuance (§3) also depends on this resolving to the gateway.
2. **GHCR package visibility.** Assumed the `rejs` package is either public or already pullable by the
   existing `ghcr-secret` in `web`. Confirm pull access before sync (§1), else pods will `ImagePullBackOff`.
3. **Image pin: tag vs digest.** Siblings pin by tag (e.g. `timeline:0.0.4`). This runbook defaults to
   `rejs:0.1.0` for consistency, but recommends a **digest** for true immutability. Decide which.
4. **`resources` block — assumption, not convention.** No sibling sets `resources`. The block in §2a is
   an added guardrail; delete it to match existing apps exactly, or keep it.
5. **`securityContext` — assumption.** Added `runAsNonRoot/runAsUser: 101` (the nginx-unprivileged UID)
   for defense-in-depth; timeline/website do not set it. Safe given the image already runs non-root, but
   verify the running UID if you change the base image.
6. **Service port style.** Mirrored timeline's named-target `targetPort: http` (vs website's literal
   `8080`). Both work; this is the closer analog. No action needed unless you standardize otherwise.

```

```
