## Context

The sidebar (v2/Sidebar) uses MediaFolderListItemV2; each item has a context menu with Delete that calls `handleDeleteButtonClick`: `removeMediaMetadata(path)` and `setUserConfig` with `folders.filter(f => Path.posix(f) !== path)`. Selection state (`selectedFolderPaths`, `primaryFolderPath`) lives in AppV2; the list already has keydown for Ctrl+A. Adding DELETE key and making context-menu Delete act on all selected folders reuses this per-folder logic.

## Goals / Non-Goals

**Goals:**

- When focus is in the sidebar folder list, pressing DELETE removes all currently selected folder(s) from the library (same effect as existing Delete: remove metadata, update user config). Single selection: one folder removed. Multiple: all selected removed.
- Context-menu Delete: when one folder is selected, delete that folder (unchanged). When multiple are selected, delete all selected folders.
- Reuse existing per-folder delete logic (removeMediaMetadata, setUserConfig); no new APIs.

**Non-Goals:**

- Confirmation dialog for batch delete (can be added later).
- Undo for batch delete.
- Backend file deletion; delete only removes folders from app config and metadata cache (existing behavior).

## Decisions

1. **Where DELETE key is handled**
   - **Decision**: Handle in the same sidebar list container that handles Ctrl+A (v2/Sidebar). On keydown, if `e.key === "Delete"` (or "Backspace" per platform convention), prevent default and call a parent-provided `onDeleteSelected(selectedFolderPaths)` (or equivalent). Only when focus is in the list (so we don't steal DELETE from search or inputs).
   - **Rationale**: Keeps keyboard handling in one place; parent owns selection and can perform batch delete and update selection.
   - **Alternatives**: Handle in each list item—rejected because we need the full selection set and one coordinated delete.

2. **Who performs batch delete**
   - **Decision**: AppV2 (or a handler it passes to Sidebar) owns batch delete. Given `selectedFolderPaths`, it loops over each path: `removeMediaMetadata(path)`; then one `setUserConfig` with `folders` = current folders minus all deleted paths. Then update selection state: remove deleted paths from `selectedFolderPaths`, and if `primaryFolderPath` was deleted, set primary to another remaining path or undefined.
   - **Rationale**: Same data (userConfig, mediaMetadatas) and APIs (removeMediaMetadata, setUserConfig) are already in AppV2; avoids prop-drilling delete logic into list items.
   - **Alternatives**: Expose a "delete paths" helper from a provider and call it from Sidebar—rejected to keep state and side effects in AppV2.

3. **Context menu Delete when multiple selected**
   - **Decision**: MediaFolderListItemV2's context menu Delete item calls a parent-provided callback: e.g. `onDelete(path)` for single-item behavior or `onDeleteSelected(selectedFolderPaths)` when the parent indicates multi-select. Simplest: Sidebar passes `onDeleteSelected: (paths: string[]) => void` to each item; when the user clicks Delete in the context menu, the item calls `onDeleteSelected(selectedFolderPaths)` (so when multiple selected, all are deleted; when one selected, pass `[path]` or `selectedFolderPaths`). So each item receives `selectedFolderPaths` (or a boolean "isMultiSelect") and `onDeleteSelected`; on Delete click it calls `onDeleteSelected(Array.from(selectedFolderPaths))` or the current selection so the parent deletes all selected.
   - **Rationale**: One contract: "delete these paths." Parent always does the same batch delete; list item just invokes with the right path set.
   - **Alternatives**: Keep Delete in list item only deleting that item when multi-select—rejected per requirement (delete all selected from context menu).

4. **DELETE key scope**
   - **Decision**: Only handle DELETE when the event target is inside the sidebar folder list (e.g. the same focusable div that has tabIndex and Ctrl+A). Do not handle when focus is in SearchForm or other inputs.
   - **Rationale**: Matches Ctrl+A behavior; avoids stealing DELETE from text fields.

## Risks / Trade-offs

- **Risk**: User presses DELETE by accident and removes folders. **Mitigation**: No change in this design; optional follow-up: confirmation dialog for batch delete or when selection size > 1.
- **Trade-off**: Batch delete is sequential (multiple removeMediaMetadata + one setUserConfig); acceptable for typical list sizes.

## Migration Plan

- No data migration. Add `onDeleteSelected` (or equivalent) to Sidebar and wire from AppV2; extend Sidebar keydown to handle DELETE; pass `onDeleteSelected` and selection into MediaFolderListItemV2 so context menu Delete calls it. Additive; existing single-folder delete behavior is preserved when selection size is one.

## Open Questions

- None for MVP. Optional: confirm dialog when `selectedFolderPaths.size > 1`.
