## Why

Users need to select multiple media folders at once (e.g., for bulk import or batch operations). The sidebar currently supports only single selection via click. Adding multi-select with keyboard (Ctrl/Cmd+A) and modifier+click (Ctrl+Click) aligns with common desktop UX and enables workflows that act on several folders.

## What Changes

- Support **Ctrl+A** (Windows/Linux) and **Cmd+A** (macOS) to select all visible media folders in the sidebar.
- Support **Ctrl+Click** (Windows/Linux) and **Cmd+Click** (macOS) on a folder to toggle its selection without clearing others (add/remove from selection).
- Extend sidebar selection model from single path to a set of paths; keep single click (without modifier) behavior configurable (e.g., replace selection or add to selection) per product choice.
- Expose selected folder set to parent (e.g., AppV2) so downstream features (import, batch actions) can use it.

## Capabilities

### New Capabilities

- `sidebar-media-folder-multi-select`: Multi-select behavior for media folder list in the sidebar—keyboard select-all, modifier+click toggle, and selection state as a set of paths.

### Modified Capabilities

- (None; this is a new UI behavior. If a future spec covers "sidebar selection contract," it would be extended there.)

## Impact

- **ui**: `Sidebar.tsx` and its props (selection state and handlers); `MediaFolderListItem` for click/keyboard handling and selected visual state.
- **State**: Selection likely lifted to `AppV2.tsx` (or a shared context) so other panels can consume selected folders.
- **APIs**: No backend API changes; optional future endpoints may take multiple folder paths.
- **Dependencies**: No new runtime dependencies; use existing React patterns and DOM keyboard/click events.
