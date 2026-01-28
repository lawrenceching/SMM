## Context

The sidebar (`Sidebar.tsx`) renders a list of media folders via `MediaFolderListItem`. Selection is currently single: `AppV2` passes `handleMediaFolderListItemClick(path)` and the "selected" folder is the one whose metadata is shown in the content area. Selection state is effectively derived from `selectedMediaMetadata` in the media-metadata-provider (the content panel shows metadata for that folder). `MediaFolderListItem` derives `selected` from `selectedMediaMetadata?.mediaFolderPath === path`. Adding multi-select must preserve a notion of "primary" or "focused" folder for the content panel while allowing a set of paths to be selected for bulk actions.

## Goals / Non-Goals

**Goals:**

- Support Ctrl+A / Cmd+A to select all visible (filtered/sorted) media folders in the sidebar.
- Support Ctrl+Click / Cmd+Click to toggle a folder in the selection set without clearing others.
- Represent selection as a set of folder paths; keep a single "primary" selection for the content panel (e.g., last clicked folder without modifier).
- Expose the selected set (and primary) to the parent so future bulk operations (e.g., import) can use them.
- Preserve existing single-click behavior: plain click selects that folder as the only selection and sets it as primary (content panel shows that folder).

**Non-Goals:**

- Shift+Click range selection (can be added later).
- Changing backend APIs or import flow in this change; only UI/state contract for multiple selected paths.

## Decisions

1. **Selection state shape**
   - **Decision**: Hold `selectedFolderPaths: Set<string>` (or `string[]`) and `primaryFolderPath: string | undefined` (the folder driving the content panel). Single click sets both: selection = { path }, primary = path. Ctrl+Click toggles path in selection and sets primary = path. Ctrl+A sets selection = all visible paths and keeps primary unchanged (or set to first visible).
   - **Rationale**: Clear separation between "what is selected" and "what the detail panel shows." Existing consumers that only care about "current folder" use `primaryFolderPath` (or the single path when only one is selected).
   - **Alternatives**: Reuse only `selectedMediaMetadata` and add a "multiSelectSet" elsewhere—rejected to avoid overloading metadata with UI selection.

2. **Where state lives**
   - **Decision**: Lift selection and primary path to `AppV2` (or a small sidebar-selection context used by AppV2 and Sidebar). Sidebar receives `selectedFolderPaths`, `primaryFolderPath`, and handlers: `onFolderClick(path, modifiers)`, `onSelectAll()`.
   - **Rationale**: AppV2 already owns `handleMediaFolderListItemClick` and passes folder list; it is the natural place to own multi-select and to pass selected set to future bulk actions. Avoids duplicating "visible folder list" in a context.
   - **Alternatives**: Put state in media-metadata-provider—rejected because selection is UI state, not metadata.

3. **Keyboard (Ctrl/Cmd+A) scope**
   - **Decision**: Ctrl+A selects all *visible* folders (after sort/filter/search). Attach keydown listener to sidebar list container or document when sidebar is focused; prevent default only when focus is inside the sidebar list so we don't steal Ctrl+A from text inputs (e.g., search).
   - **Rationale**: Matches user expectation (select what you see). Prevents stealing Ctrl+A from SearchForm.
   - **Alternatives**: Select all folders in config regardless of filter—rejected as confusing when list is filtered.

4. **Visual feedback**
   - **Decision**: `MediaFolderListItem` receives an `isSelected` prop (derived from `selectedFolderPaths.has(path)`) and optionally `isPrimary` for subtle distinction (e.g., primary = stronger highlight). Reuse existing `selected` styling for any selected item.
   - **Rationale**: Keeps list item presentational; parent computes selection from set.

5. **Single click (no modifier)**
   - **Decision**: Plain click: set selection to exactly { path } and primary to path (current behavior). No change to existing "click one folder to show it in the panel" behavior.
   - **Rationale**: Backward compatible and matches common multi-select UX (plain click replaces selection).

## Risks / Trade-offs

- **Risk**: Ctrl+A in sidebar conflicts with global "Select All" in a text field. **Mitigation**: Only handle Ctrl/Cmd+A when the event target is inside the sidebar list (or when sidebar list has focus), not when focus is in SearchForm or other inputs.
- **Trade-off**: We do not implement Shift+Click range selection in this change; can be added later if needed.

## Migration Plan

- No data migration. Add new props/state in AppV2 and Sidebar; keep existing `handleMediaFolderListItemClick` signature extended to support modifiers (e.g., new handler `onFolderClick(path, { ctrlKey })` or separate `onSelectAll`). Feature is additive; single-selection behavior remains default.

## Open Questions

- None for MVP. Optional follow-up: expose "selected count" in status bar or toolbar for bulk actions.
