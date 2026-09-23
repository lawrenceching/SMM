# Dispatch reuse via parent_run_id

This design document describe the high level design of a feature.
The design document is golden source and reference by one or more features.

## 1. Background

Orchestrators (Release, CI, Pre Release) use `ci/dispatch-and-wait-workflow.sh` to start child `workflow_dispatch` runs and wait. A failed child that is later fixed by "Re-run failed jobs" on the **child** still leaves the parent dispatch step failed. Re-running the parent previously always started a **new** child, wasting time and ignoring the already-green child.

Maintainers asked that reuse only count children **dispatched by the same parent workflow run**, so parameters stay exactly those the orchestrator passed.

## 2. Architecture

### 2.1 Correlation

1. While running inside Actions, the script sets `parent_run_id` from `DISPATCH_PARENT_RUN_ID` or `GITHUB_RUN_ID`.
2. It passes `-f parent_run_id=<id>` on `gh workflow run`.
3. Child workflows declare optional `parent_run_id` and set:
   `run-name: "... «parent:${{ inputs.parent_run_id || 'manual' }}»"`.
4. Before dispatching, the script lists recent `workflow_dispatch` runs for that workflow file and looks for `headSha` match plus display title containing the exact marker `«parent:<id>»` (delimiter avoids `123` matching `1234`).

### 2.2 Reuse rules

| Found | Action |
|-------|--------|
| success + marker + sha | Exit 0 (reuse; no new dispatch) |
| in_progress/queued/… + marker + sha | `gh run watch` that run |
| none | Dispatch with `parent_run_id`, then watch |

Manual runs (`«parent:manual»`) are never reused by an orchestrator.

A **new** Release click (new `GITHUB_RUN_ID`) does not reuse the previous Release's children; use `skip_build` / `skip_pre_release` if needed.

### 2.3 Files

- `ci/dispatch-and-wait-workflow.sh` — reuse + pass `parent_run_id`
- `build.yml`, `pre-release.yml`, `e2e-*.yml` — input + `run-name`
- `docs/dev/release.md` — operator note

## 3. User Stories

### 3.1 Re-run failed parent after child fixed

* **Given** - Release dispatched Build; Build failed; maintainer re-ran failed Build jobs until green
* **When** - maintainer re-runs failed jobs on the same Release run
* **Then** - Dispatch Build reuses the successful Build with matching `«parent:<release-run-id>»` and continues

### 3.2 Manual Build not reused

* **Given** - a manual Build succeeded on the same SHA
* **When** - Release dispatches Build
* **Then** - a new Build is started (manual title is `«parent:manual»`)
