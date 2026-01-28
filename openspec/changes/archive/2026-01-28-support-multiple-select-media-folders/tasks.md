## 1. Selection state in AppV2

- [x] 1.1 Add state in AppV2 for `selectedFolderPaths` (Set or array of paths) and `primaryFolderPath` (string | undefined)
- [x] 1.2 Wire primary folder to existing content panel: when `primaryFolderPath` is set, set `selectedMediaMetadata` to the metadata for that path (preserve existing content panel behavior)
- [x] 1.3 Ensure single-folder click still works: plain click sets selection to { path } and primary to path, and content panel shows that folder

## 2. Sidebar props and click handling

- [x] 2.1 Extend Sidebar props: pass `selectedFolderPaths`, `primaryFolderPath`, and a single handler `onFolderClick(path: string, modifiers: { ctrlKey: boolean; metaKey: boolean })` (or equivalent)
- [x] 2.2 In AppV2, implement click handler: if modifiers.ctrlKey || modifiers.metaKey, toggle path in selection and set primary = path; else set selection = { path }, primary = path
- [x] 2.3 Pass `onSelectAll` (or equivalent) to Sidebar that sets selection to all visible folder paths and keeps/updates primary

## 3. MediaFolderListItem selection UI

- [x] 3.1 Add `isSelected` and optional `isPrimary` props to MediaFolderListItem; remove or override internal derivation from `selectedMediaMetadata` for selection highlight when multi-select is used
- [x] 3.2 Use existing selected styling when `isSelected`; optionally apply stronger style when `isPrimary`
- [x] 3.3 In Sidebar, pass click handler that includes event (to read ctrlKey/metaKey) and call parent `onFolderClick(path, { ctrlKey, metaKey })`

## 4. Keyboard: Ctrl+A / Cmd+A

- [x] 4.1 Add keydown listener on sidebar list container (or a wrapper div that contains only the folder list, not the search input)
- [x] 4.2 When Ctrl+A or Cmd+A is pressed and target is inside the folder list, prevent default and call `onSelectAll`; do not handle when focus is in SearchForm or other inputs
- [x] 4.3 Ensure "visible" folders for Select All are the same as the current `filteredAndSortedFolders` list passed to Sidebar

## 5. Backward compatibility and tests

- [x] 5.1 Verify existing call sites: content panel still shows the selected folder; single click still selects one folder and updates panel
- [x] 5.2 Manually verify: Ctrl+Click toggles selection; Ctrl+A selects all visible folders; selection set and primary are available to parent for future bulk actions
