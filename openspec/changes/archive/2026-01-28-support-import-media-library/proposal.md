## Why

Currently, users can only import one media folder at a time through the "Open Folder" menu item. When users have a media library containing multiple media folders (e.g., a TV show library with dozens of shows), they must manually import each folder individually, which is time-consuming and inefficient. This change enables bulk import of all media folders within a selected media library directory, significantly improving the user experience for users managing large media collections.

## What Changes

- Add new menu item "Open Media Library" in the application menu
- Implement media library folder selection dialog (native file dialog in Electron, file picker in web)
- Extend folder type selection dialog to support media library context (all folders in library share the same type: tvshow, movie, or music)
- Add batch processing logic to iterate through all subfolders in the selected media library and import each as a media folder
- Reuse existing `onFolderSelected` handler for each media folder to maintain consistency with single-folder import flow

## Capabilities

### New Capabilities
- `import-media-library`: Capability to select a media library folder, choose a media type for all contained folders, and automatically import all media folders within the library using the existing single-folder import infrastructure.

### Modified Capabilities
<!-- No existing capabilities are being modified at the spec level. The existing single-folder import capability remains unchanged; this adds a new bulk import workflow that reuses it. -->

## Impact

**Affected Components:**
- `ui/src/components/menu.tsx` - Add new menu item and handler
- `ui/src/AppV2.tsx` - Add media library import handler that orchestrates batch folder selection and import
- `ui/src/providers/dialog-provider.tsx` - May need to support media library context in folder type selection dialog

**APIs:**
- Reuses existing `/api/listFiles` endpoint to enumerate subfolders in the media library directory
- No new API endpoints required

**Dependencies:**
- Existing `onFolderSelected` handler from `useEventHandlers` hook
- Existing `openOpenFolder` dialog for folder type selection
- Existing `openNativeFileDialog` and `filePickerDialog` for folder selection
- Existing `listFiles` API for directory enumeration

**User Experience:**
- Reduces manual effort for users with large media collections
- Maintains consistency with existing single-folder import workflow
- All imported folders share the same media type (tvshow/movie/music) as selected by the user
