## Why

Persisting sidebar-selected folder through backend user-config writes introduces uncontrollable timing and race risks in UI flows. UI-only selection state should be stored on the client side to avoid backend write contention and accidental corruption of persistent application config.

## What Changes

- Move sidebar selected-folder persistence from backend `setAndSaveUserConfig` writes to browser `localStorage`.
- Restore selected folder from `localStorage` during UI startup/hydration, with safe fallback when missing/stale.
- Stop writing UI-only selection changes into backend `smm.json`.
- Keep folder list/config persistence behavior unchanged for actual managed media folders.
- Update tests to validate selected-folder persistence via localStorage-backed behavior and ensure no backend config side effects.

## Capabilities

### New Capabilities
- `sidebar-selection-local-persistence`: Persist and restore sidebar selected folder using localStorage only.

### Modified Capabilities
- `sidebar-selection-persistence`: Change selection persistence contract from backend user-config storage to localStorage storage, including restore and fallback behavior.

## Impact

- Affected code: `apps/ui/src/AppV2.tsx`, sidebar/store initialization and selection restore flows, user-config persistence call sites tied to selection updates.
- Affected tests: sidebar selection persistence E2E/unit coverage and any tests asserting selected-folder writes to user config.
- APIs/systems: removes backend dependency for selected-folder UI persistence; no backend API contract changes required.
