## Why

Users need to remove media folders from the library quickly. The sidebar already supports single-folder delete via the context menu. Adding keyboard DELETE and reusing the same delete logic for the current selection (single or multiple) reduces friction and supports batch removal when multiple folders are selected.

## What Changes

- Support **DELETE** key: when focus is in the sidebar media folder list, pressing DELETE removes the selected folder(s) from the library (same effect as the existing context-menu Delete). Reuse the logic from `handleDeleteButtonClick` in MediaFolderListItem (remove from metadata, update user config).
- **Single selection**: DELETE removes the one selected folder.
- **Multiple selection**: DELETE removes all selected folders (apply the same per-folder delete logic for each).
- **Context menu Delete**: when multiple folders are selected, the Delete item in the context menu removes all selected folders (not only the folder under the cursor). When a single folder is selected, behavior is unchanged (delete that folder).

## Capabilities

### New Capabilities

- `sidebar-batch-delete-media-folder`: Batch deletion of media folders from the sidebar—keyboard DELETE for selected folder(s) and context-menu Delete for all selected folders, reusing existing per-folder delete logic (remove metadata, update config).

### Modified Capabilities

- (None; multi-select is already specified in `sidebar-media-folder-multi-select`. This change adds deletion actions on the selection set; no change to selection requirements.)

## Impact

- **ui**: Sidebar list (keydown for DELETE), MediaFolderListItem or MediaFolderListItemV2 (context menu Delete when multi-select: delete all selected). AppV2 or parent: expose selected paths and a delete handler that applies per-folder delete for each path.
- **State**: Reuse existing selection state (`selectedFolderPaths`, `primaryFolderPath`). After batch delete: clear deleted paths from selection and update primary if the primary was deleted.
- **APIs**: No new backend APIs; reuse existing metadata and config update flows used by single-folder delete.
- **Dependencies**: Depends on sidebar multi-select (selection set and primary) and existing delete logic (removeMediaMetadata, setUserConfig).
