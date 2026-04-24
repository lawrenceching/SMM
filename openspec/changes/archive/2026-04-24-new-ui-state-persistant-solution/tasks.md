## 1. LocalStorage Persistence Wiring

- [x] 1.1 Add a dedicated localStorage key/utility for sidebar selected-folder persistence with path normalization.
- [x] 1.2 Replace `AppV2` selected-folder backend persistence (`setAndSaveUserConfig`) with localStorage writes guarded by resolved folder identity and change detection.
- [x] 1.3 Ensure selected-folder persistence writes are skipped when selection is unresolved, unchanged, or invalid during hydration transitions.

## 2. Startup Restore and Fallback

- [x] 2.1 Update startup reconciliation flow to read selected-folder value from localStorage instead of backend user config.
- [x] 2.2 Apply restored selection only after folder list hydration and only when the stored value resolves to an existing folder.
- [x] 2.3 Keep deterministic fallback to existing default selection behavior when localStorage value is missing/stale/unavailable.

## 3. Remove Backend Coupling for UI Selection

- [x] 3.1 Remove selected-folder-specific backend config write expectations from UI flows while keeping managed-folder config writes intact.
- [x] 3.2 Validate that selected-folder changes no longer trigger `/api/writeFile` for `smm.json`.
- [x] 3.3 Confirm legacy backend `selectedFolder` field is ignored for UI restore path.

## 4. Verification

- [x] 4.1 Update/add unit tests for localStorage persist/restore behavior, including stale value fallback.
- [x] 4.2 Update/add E2E coverage to verify selected folder survives relaunch via localStorage and does not regress sidebar behavior.
- [x] 4.3 Run relevant test suite(s) and record verification results for this change.
