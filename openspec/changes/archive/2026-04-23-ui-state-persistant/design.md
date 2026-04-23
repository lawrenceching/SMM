## Context

The desktop app's sidebar allows users to select a media directory, but this UI state is currently session-only. After relaunch, users must reselect their working directory, which interrupts common workflows. The project already has user configuration persistence and sidebar state logic, so this change should integrate with those existing mechanisms instead of introducing a new storage channel.

## Goals / Non-Goals

**Goals:**

- Persist the currently selected sidebar directory whenever the user changes selection.
- Restore that directory at startup once directory data is available.
- Keep startup stable when persisted data is stale (directory removed, renamed, or inaccessible).
- Make behavior testable in E2E flows, including relaunch scenarios.

**Non-Goals:**

- Persisting other sidebar UI states (expand/collapse, sorting, filter text).
- Creating a new storage backend beyond existing user config persistence.
- Auto-repairing filesystem issues if a persisted directory no longer exists.

## Decisions

- Persist selection as a stable directory identifier in user config.
  - Rationale: user config is already cross-session and app-scoped; reusing it avoids duplicate persistence logic.
  - Alternative considered: local-only in-memory cache (rejected because it does not survive relaunch).
- Restore selection in post-load reconciliation logic instead of preloading raw UI state.
  - Rationale: restoration must verify that the selected directory exists in the freshly loaded sidebar dataset.
  - Alternative considered: initialize store directly from persisted value before load (rejected because it can point to unknown data and produce inconsistent UI).
- Add guarded fallback behavior when restore fails.
  - Rationale: if persisted directory is invalid, app should choose default selection behavior and continue without errors.
  - Alternative considered: hard error or modal prompt on missing directory (rejected as disruptive for a non-critical preference).
- Validate via E2E component-object helpers and relaunch test coverage.
  - Rationale: user-visible requirement is restart persistence; E2E verification best matches actual behavior.
  - Alternative considered: unit-only validation (rejected because restart/state-hydration interactions are integration-level).

## Risks / Trade-offs

- [Persisted identifier schema drifts from runtime directory identity] -> Mitigation: use existing canonical directory identity format and centralize mapping logic.
- [Restore timing race with async directory loading] -> Mitigation: apply restore only after sidebar directory list is available and gate with one-time hydration flag.
- [Stale persisted value causes unexpected default selection] -> Mitigation: explicitly detect unresolved directory and fall back deterministically.
- [Extra writes to user config on frequent selection changes] -> Mitigation: write only when selection value actually changes.
