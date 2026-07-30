# Docker Compose E2E CI (config suite first)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Host Runner + Compose (`smm` + `http-proxy`) for Docker e2e, with a manual GitHub Actions workflow that runs only `./common/config/*.e2e.ts`.

**Architecture:** Replace bare `docker run` in `ci/e2e-docker-container.ts` with `docker compose up` of two services on one network. WDIO/Chrome stay on the GitHub/host runner and talk to published `:30000`. Proxy URL written into app config is the Compose DNS name (`http://http-proxy:8990`); host-side probe uses a published localhost URL via env.

**Tech Stack:** Docker Compose, GitHub Actions `workflow_dispatch`, existing `bun ci/run-e2e-test.ts --platform docker`, proxy-chain (same as desktop embedded proxy).

**Locked scope**
- Specs: only `./common/config/*.e2e.ts` (6 files). Other suites migrate later.
- Image: build intermediate images + `smm:latest` for `linux/amd64` only inside the same workflow (no GHCR push).
- Exclude manual / failover from this workflow.

See also: [design](../design/docker-compose-e2e-ci/design.md)

## Env contract

| Env | Who uses it | Default / CI value |
|-----|-------------|-------------------|
| `E2E_DOCKER_UI_ORIGIN` | Host WDIO + wait-ready | `http://localhost:30000/` |
| `TMDB_HTTP_PROXY` / `TVDB_HTTP_PROXY` | Written into userConfig (must resolve **inside smm**) | CI: `http://http-proxy:8990` |
| `E2E_HTTP_PROXY_PROBE_URL` | Host `isHttpProxyAccessible` only | CI: `http://127.0.0.1:8990` |
| `SMM_AUTH_TOKEN` | Container + WDIO | `ChangeMe123` |

## Implementation checklist

- [x] Design doc + compose + http-proxy image
- [x] Switch e2e-docker-container.ts to docker compose up/down
- [x] E2E_DOCKER_UI_ORIGIN + E2E_HTTP_PROXY_PROBE_URL + unit tests
- [x] Add e2e-docker.yml workflow_dispatch for common/config only
- [x] Update verification doc
