# Unused Code Detection (noUnusedLocals / noUnusedParameters / knip)

This design document describes the high level design of enabling unused code
detection across the monorepo and integrating [knip](https://knip.dev) into CI.

## 1. Background

Dead code (unused locals, unused parameters, unused files/exports/dependencies)
accumulates silently. The monorepo currently has inconsistent coverage:

| Workspace | `noUnusedLocals` / `noUnusedParameters` | Notes |
|-----------|-----------------------------------------|-------|
| `apps/ui` | enabled (`tsconfig.app.json`, `tsconfig.node.json`) | ESLint `@typescript-eslint/no-unused-vars` also on (error) |
| `apps/cli`, `apps/core`, `apps/e2e` | explicitly `false` | |
| `packages/*`, `apps/convex`, `apps/cicd`, `apps/tools`, `apps/ohos`, `apps/electron` | not set (default off) | electron inherits `@electron-toolkit/tsconfig` |

A baseline scan (`tsc --noEmit --noUnusedLocals --noUnusedParameters` per
workspace) found ~87 existing violations:

| Workspace | Errors |
|-----------|--------|
| `apps/cli` | 45 |
| `packages/core-routes` | 15 |
| `apps/e2e` | 15 |
| `apps/core` | 7 |
| `packages/tvdb4` | 3 |
| `apps/cicd` | 2 |
| others (types, utils, electron-common, test, electron, convex, tools) | 0 |
| `apps/ohos` | 274 (excluded — see below) |

`apps/ohos` is **excluded from this change**. Its tsconfig pulls
`packages/core-routes` sources in via `@smm/core-routes/*` path mappings, so
its scan re-reports (and amplifies) core-routes findings under a different
config — enabling the flags there would surface errors in files ohos does not
own. ohos will be enabled in a follow-up change after `core-routes` is cleaned
up and the config interaction is triaged.

Goals:

1. Enable `noUnusedLocals` / `noUnusedParameters` in all TS workspaces so new
   unused code fails typecheck.
2. Integrate knip at the monorepo root to report unused files, dependencies,
   and exports.
3. Add a knip job to the `CI` GitHub Actions workflow. **Advisory only for
   now** (`continue-on-error: true`): the report must not block CI until the
   existing findings are triaged and cleaned up.

Non-goals:

- Fixing knip findings (unused files/exports/deps) in this change; the CI job
  is report-only. A follow-up change will clean up and then remove
  `continue-on-error` to turn the job into a gate.
- Enabling the flags in `apps/ohos` (see the exclusion note above).
- Changes to ESLint rule severity. `apps/ui` keeps its existing
  `no-unused-vars` error rule; no new ESLint rules are added.

## 2. Architecture

### 2.1 Project Level Architecture

The monorepo (pnpm workspaces: `apps/*`, `packages/*`) gains two repo-wide
quality gates:

- **Typecheck gate (blocking, existing)**: `pnpm typecheck` per workspace now
  also fails on unused locals/parameters once the flags are enabled.
- **Knip report (non-blocking, new)**: a new `knip` job in
  `.github/workflows/ci.yml` runs `knip` from the repo root across all
  workspaces. It is excluded from `RELEASE_REQUIRED_CHECKS` and from all gate
  job dependencies.

### 2.2 App Level Architecture

No runtime code paths change. The touched artifacts are:

- `tsconfig.json` (or `tsconfig.app.json` where the pattern exists) of every
  TS workspace except `apps/ohos`: add
  `"noUnusedLocals": true, "noUnusedParameters": true`
  (flip existing `false` values in `apps/cli`, `apps/core`, `apps/e2e`).
- Source/test files with the ~87 existing violations: unused locals/imports
  are deleted; intentionally-unused parameters are renamed with a `_` prefix
  (matching the existing `argsIgnorePattern: '^_'` ESLint convention in
  `apps/ui`).
- Root `package.json`: `knip` devDependency + `"knip": "knip"` script.
- Root `knip.json`: knip configuration (workspaces, entry patterns, ignores).
- `.github/workflows/ci.yml`: new `knip` job.

### 2.3 Key Design

**Fix strategy for the 87 violations** — case-by-case, not mechanical:

- Unused local variable / import → delete it.
- Unused parameter that is part of a fixed signature (interface
  implementation, callback contract, test fixture) → prefix with `_`.
- If a deletion would change public behavior or API surface, keep the code
  and prefix with `_` instead.

**knip configuration** — single root `knip.json` using knip's automatic pnpm
workspace detection plus its built-in plugins (vite, vitest, electron, bun).
Each workspace declares its entry points; known framework files that knip
cannot see through (generated code, config-only entry files) are listed in
`ignore`/`ignoreDependencies`. The `apps/ohos` workspace is ignored initially
(HarmonyOS/hvigor entry points are outside knip's plugin coverage); it can be
added once its entry points are mapped. The first real CI run's output drives
the initial ignore list; noise is acceptable because the job is advisory.

**CI job** —

```yaml
knip:
  name: Knip (unused code report)
  runs-on: ubuntu-latest
  continue-on-error: true
  steps:
    - uses: actions/checkout@v4
    - uses: pnpm/action-setup@v4
    - run: pnpm install --frozen-lockfile
    - run: pnpm knip
```

`knip.json` is added to the workflow's `paths` triggers so config changes run
the job. The job is independent (no `needs`), so it never blocks test / lint /
typecheck / build / e2e gates. Removing `continue-on-error: true` later
promotes it to a gate with no other edits.

**Verification**

- `pnpm typecheck` green across all workspaces after the flags are enabled.
- `pnpm -r test` and `pnpm build` unaffected (no runtime changes).
- `pnpm knip` runs locally and in CI; exits non-zero on findings but the CI
  job stays green due to `continue-on-error`.

## 3. User Stories

### 3.1 Typecheck catches new unused code in any workspace

* **Given** - a workspace has `noUnusedLocals` / `noUnusedParameters` enabled
* **When** - a developer commits a file with an unused local or parameter
* **Then** - `pnpm typecheck` fails with TS6133/TS6196 and CI blocks the merge

### 3.2 CI reports unused files/exports/dependencies without blocking

* **Given** - the `knip` job exists in the `CI` workflow
* **When** - a push/PR contains unused files, exports, or dependencies
* **Then** - the job prints the knip report in the run log, the job (and the
  whole workflow) still succeeds, and the report is not part of any required
  check

### 3.3 Knip config changes re-run the report

* **Given** - `knip.json` is listed in the workflow `paths` triggers
* **When** - a developer tunes the ignore list
* **Then** - CI runs the knip job again so the effect of the config change is
  visible in the run
