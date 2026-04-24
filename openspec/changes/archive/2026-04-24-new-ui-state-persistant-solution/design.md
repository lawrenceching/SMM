## Context

The current sidebar selection persistence writes `selectedFolder` through the same backend user-config pipeline used for durable application settings. Runtime evidence from rename-flow failures showed this introduces cross-flow race conditions: UI-driven selection writes can overlap with import/update writes to `smm.json`, causing stale overwrites and occasional invalid JSON snapshots. Since selected sidebar folder is UI session preference, not backend domain state, it should not share backend persistence with managed folder configuration.

## Goals / Non-Goals

**Goals:**
- Persist selected sidebar folder in `localStorage` only.
- Restore selected folder from localStorage after folder data hydrates.
- Prevent selected-folder UI updates from writing backend `smm.json`.
- Preserve deterministic fallback behavior when stored selection is missing/stale.
- Keep managed-folder backend persistence unchanged.

**Non-Goals:**
- Reworking all user-config persistence logic.
- Changing folder import/delete backend ownership.
- Migrating arbitrary UI preferences beyond selected sidebar folder.
- Introducing new server APIs for UI state.

## Decisions

1. Store selected folder under a dedicated localStorage key managed by UI.
   - Rationale: isolates UI preference from backend config and removes cross-request write races.
   - Alternative considered: keep backend persistence with stricter write ordering; rejected due to broader coupling and continued contention risk.

2. Persist selection only after validating it maps to currently known folder identities.
   - Rationale: avoids storing transient/stale values during initialization and prevents noisy writes.
   - Alternative considered: write immediately on every state transition; rejected because hydration races can persist invalid values.

3. Restore selection in post-hydration reconciliation flow.
   - Rationale: matching against loaded folder list is required for safe restore and predictable fallback.
   - Alternative considered: pre-hydration forced selection; rejected due to unresolved identity at startup.

4. Keep compatibility fallback to default selection behavior when localStorage value cannot be resolved.
   - Rationale: startup must remain non-blocking and resilient to stale storage.
   - Alternative considered: hard error or user prompt; rejected as disruptive for preference data.

## Risks / Trade-offs

- [localStorage unavailable or blocked in some environments] -> Mitigation: treat storage operations as best effort and continue with default selection behavior.
- [identity drift between stored path and runtime canonical path] -> Mitigation: normalize paths consistently before compare/persist.
- [legacy selectedFolder value remains in backend config] -> Mitigation: ignore backend field for UI restore and rely on localStorage source of truth.
- [test brittleness due to async hydration timing] -> Mitigation: assert selection after folder list hydration and add explicit retry windows in E2E tests.

## Migration Plan

1. Introduce localStorage key + read/write utility for selected folder.
2. Switch `AppV2` selected-folder persistence effect to localStorage writes only.
3. Update restore flow to read localStorage value and apply after folder data is ready.
4. Remove any selected-folder backend write expectation in tests; add localStorage-focused assertions.
5. Verify no `/api/writeFile` calls are triggered solely by selection changes.

## Open Questions

- Should we add a lightweight versioned localStorage payload now for future compatibility, or keep plain string value until needed?
