# rejs documentation

Project documentation for **rejs**, the backend-free journey planner. This
folder holds the deeper, topic-by-topic docs; the repo root
[`README.md`](../README.md) is the entry point (what rejs is, quick start, the
DSL at a glance).

## Contents

| Doc                                                          | What it covers                                                                                                         |
| ------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| [`architecture.md`](./architecture.md)                       | How rejs works internally: the DSL → parse → resolve → render pipeline, module map, state/persistence, geocoding.      |
| [`share-links.md`](./share-links.md)                         | Share links: the self-contained `#plan=` URL format, and the optional url-shortener integration (short, stable links). |
| [`deploy/container.md`](./deploy/container.md)               | The container image: multi-stage build, nginx config, security headers/CSP, and build-time config.                     |
| [`deploy/infra-onboarding.md`](./deploy/infra-onboarding.md) | GitOps/ArgoCD runbook for deploying rejs to `rejs.lillevang.dev`.                                                      |

## Other sources of truth

Some things are documented closer to the code and stay canonical there — don't
duplicate them here:

- **The DSL reference** — the in-app **DSL guide** (toolbar help button, backed
  by `src/lib/dsl-reference.ts`) is the always-current reference; every snippet
  in it is parsed by a test, so it can't drift from the parser. The root README
  has a compact teaser.
- **File map / public API surface** — [`.agent/CODEBASE.md`](../.agent/CODEBASE.md)
  (auto-generated tree + hand-written "why").
- **Open/'shipped' feature ideas** — [`IDEAS.md`](../IDEAS.md) /
  [`IMPLEMENTED.md`](../IMPLEMENTED.md).

## Keeping docs current

These docs are part of the change, not an afterthought: any change that alters
behavior, architecture, the DSL, deployment, or configuration must update the
relevant doc **in the same commit**. See the "Documentation" section in
[`.agent/AGENTS.md`](../.agent/AGENTS.md).
