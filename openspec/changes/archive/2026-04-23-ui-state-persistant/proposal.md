## Why

Users currently lose their selected media directory when they restart the desktop app, forcing repeated navigation before they can continue work. Persisting and restoring the last selected directory removes this friction and makes app state consistent across sessions.

## What Changes

- Persist the sidebar's currently selected directory to user configuration when selection changes.
- Restore the previously selected directory when the app starts and sidebar data is ready.
- Gracefully handle invalid or missing persisted directories by falling back to default selection behavior.
- Add or update end-to-end coverage to verify selection is retained after relaunch.

## Capabilities

### New Capabilities

- `sidebar-selection-persistence`: Persist and restore the sidebar-selected directory across app restarts.

### Modified Capabilities

- None.

## Impact

- Affected code: sidebar selection state management, user config read/write hooks, app initialization flow, and `apps/e2e/test/componentobjects/Sidebar.ts` plus related specs.
- Affected behavior: selected directory survives app restart instead of resetting each launch.
- Dependencies: existing user config persistence pipeline and sidebar directory identity mapping.
