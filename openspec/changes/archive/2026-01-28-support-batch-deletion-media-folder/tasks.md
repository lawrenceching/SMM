## 1. Batch delete handler in AppV2

- [x] 1.1 Add `onDeleteSelected(paths: string[])` (or equivalent) in AppV2: for each path call `removeMediaMetadata(path)`; then one `setUserConfig` with `folders` = current `userConfig.folders` minus all deleted paths
- [x] 1.2 After batch delete, update selection state: set `selectedFolderPaths` to exclude deleted paths; if `primaryFolderPath` was deleted, set `primaryFolderPath` to another remaining path or undefined
- [x] 1.3 Pass `onDeleteSelected` to Sidebar (e.g. as a new prop)

## 2. DELETE key and Sidebar props

- [x] 2.1 Extend Sidebar props: add `onDeleteSelected: (paths: string[]) => void` (or equivalent)
- [x] 2.2 In the sidebar list container keydown handler, when `e.key === "Delete"` (and focus is in the list), prevent default and call `onDeleteSelected(Array.from(selectedFolderPaths))`; do not handle when focus is in search or other inputs
- [x] 2.3 In AppV2, wire Sidebar `onDeleteSelected` to the batch delete handler from task 1

## 3. Context menu Delete in MediaFolderListItemV2

- [x] 3.1 Add optional `selectedFolderPaths` (or `pathsToDelete: string[]`) and `onDeleteSelected: (paths: string[]) => void` props to MediaFolderListItemV2; when provided, context menu Delete calls `onDeleteSelected(Array.from(selectedFolderPaths))` (or the passed paths) instead of the current single-folder `handleDeleteButtonClick`
- [x] 3.2 When `onDeleteSelected` is not provided, keep existing behavior: context menu Delete calls `handleDeleteButtonClick` (delete only this folder)
- [x] 3.3 In Sidebar, pass `selectedFolderPaths` and `onDeleteSelected` to each MediaFolderListItemV2 so context menu Delete deletes all selected folders when multiple are selected

## 4. Verification

- [x] 4.1 Verify: focus in folder list, one folder selected, DELETE removes that folder and selection updates
- [x] 4.2 Verify: multiple folders selected, DELETE removes all selected and selection updates; primary updates if it was deleted
- [x] 4.3 Verify: multiple folders selected, context menu Delete removes all selected; single selected, context menu Delete removes that folder (unchanged behavior)
- [x] 4.4 Verify: focus in search input, DELETE does not delete folders
