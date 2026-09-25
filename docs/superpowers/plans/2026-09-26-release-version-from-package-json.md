# Release version from package.json Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Derive Git tag and Docker image tag from `apps/electron` / `apps/docker` package.json versions; stop requiring manual `tag_name` on Release workflows.

**Architecture:** `ci/resolve-release-version.ts` reads package.json (or optional override), emits `version` / `git_tag` / `docker_tag`. Release workflows resolve first, then pass `git_tag` into ensure-tag / GitHub Release and `docker_tag` into Hub push + notes.

**Tech Stack:** Bun, GitHub Actions, package.json

**Design:** [docs/superpowers/design/release-version-from-package-json/design.md](../design/release-version-from-package-json/design.md)

## Global Constraints

- Docker Hub semver tag has **no** leading `v`
- Git tag / GitHub Release use `v` + semver
- Joint release requires electron version === docker version
- Optional `version_override` for emergency only

---

### Task 1: Helper + unit tests

**Files:**
- Create: `ci/resolve-release-version-lib.ts`
- Create: `ci/resolve-release-version.ts`
- Create: `ci/resolve-release-version.test.ts`
- Modify: `apps/docker/package.json` (add `"version": "1.4.14"`)

- [x] Implement resolve lib (product electron|docker|all, override, strip leading v)
- [x] CLI prints KEY=VALUE lines
- [x] Tests: match, mismatch fail, override, strip v
- [x] Add docker package.json version matching electron

### Task 2: Wire workflows

**Files:**
- Modify: `.github/workflows/release-all.yml`
- Modify: `.github/workflows/release.yml`
- Modify: `.github/workflows/release-docker.yml`
- Modify: `.github/workflows/_build-docker-push.yml` (semver_tag description: no v)

- [x] Add `resolve-version` job; remove required `tag_name` from dispatch
- [x] Optional `version_override` input
- [x] Pass `git_tag` / `docker_tag` through ensure-tag, publish, notes
- [x] Update `docs/dev/release.md`
