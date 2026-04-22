## 1. Selection mode state orchestration

- [x] 1.1 Add `isMultiSelectMode` state and mode toggle handlers in `MusicPanel`.
- [x] 1.2 Pass mode state and toggle callbacks from `MusicPanel` to `MusicHeaderV2` and `MusicFileTable`.
- [x] 1.3 Ensure canceling selection mode clears selected row ids in panel-managed state.

## 2. Header toggle and table rendering behavior

- [x] 2.1 Update `MusicHeaderV2` to render `Select` when mode is inactive and `Cancel` when mode is active.
- [x] 2.2 Implement `MusicFileTable` multi-select mode prop and conditional first checkbox column rendering.
- [x] 2.3 Keep non-selection mode table rendering unchanged when multi-select mode is off.

## 3. Selection interactions and validation

- [x] 3.1 Implement row checkbox selection handling in `MusicFileTable` using stable row identifiers.
- [x] 3.2 Add or update tests for Select -> multi-select mode transition and Cancel -> mode exit transition.
- [x] 3.3 Add or update tests for checkbox column visibility rules and selection reset on Cancel.
- [x] 3.4 Run relevant UI test suites and fix any regressions introduced by multi-select mode changes.
