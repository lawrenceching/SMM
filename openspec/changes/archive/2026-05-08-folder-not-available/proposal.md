## Why

Imported media folders may no longer exist on disk (deleted, moved, renamed, or on an unreachable drive). Today the app does not clearly distinguish that case, which leads to confusing panels and wasted operations. We should detect unavailable paths early and surface a dedicated experience.

## What Changes

- Add a backend HTTP endpoint to verify whether a folder path exists and is accessible (e.g. `POST /api/isFolderAvailable`).
- After user config is loaded into the UI media folder store, call that endpoint for each configured folder path and mark folders that fail as `folder_not_found` (or equivalent agreed status on `UIMediaFolder`).
- In the main app shell (`AppV2`), when the selected folder has that status, show a **Folder not available** panel instead of TvShow, Movie, Music, or local file panels.
- No change to how `UserConfig` itself is persisted; availability is derived state on top of configured paths.

## Capabilities

### New Capabilities

- `media-folder-availability`: Discovering whether configured media folder paths are currently available on the host filesystem, exposing that to the UI, and replacing primary content panels with a folder-unavailable view when appropriate.

### Modified Capabilities

(None. Existing user-config query behavior stays the same; we add filesystem checks and UI routing after config is known.)

## Impact

- **apps/cli**: New route/handler for folder availability check; reuse existing path/fs utilities where possible.
- **apps/ui**: `UIMediaFolderStoreInitializer` (or sync hook) triggers checks; `UIMediaFolder` type / store; `AppV2` panel selection; new `FolderNotAvailablePanel` component.
- **packages/core** (if needed): Shared types or constants for folder availability status.
- **Testing**: Unit tests for CLI handler; optional UI tests for panel switching.
