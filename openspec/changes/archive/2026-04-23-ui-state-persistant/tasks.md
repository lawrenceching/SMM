## 1. Selection Persistence Wiring

- [x] 1.1 Identify the canonical sidebar directory identifier and map it to a persisted user-config field.
- [x] 1.2 Update sidebar selection change handling to write the selected directory identifier when it changes.
- [x] 1.3 Guard persistence writes to avoid redundant writes when the selected directory is unchanged.

## 2. Startup Restore Flow

- [x] 2.1 Read persisted selected directory during app startup/hydration using existing user-config hooks.
- [x] 2.2 Apply persisted selection only after sidebar directory data is loaded and resolvable.
- [x] 2.3 Implement fallback to default selection behavior when persisted selection is missing, invalid, or stale.

## 3. Verification

- [x] 3.1 Extend `apps/e2e/test/componentobjects/Sidebar.ts` helpers to expose and assert selected directory behavior.
- [x] 3.2 Add/update E2E scenario that selects a directory, relaunches the app, and verifies restored selection.
- [x] 3.3 Run relevant E2E checks and stabilize any timing issues in relaunch-state assertions. (Manually validated by user.)
