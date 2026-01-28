## 1. Menu Integration

- [x] 1.1 Add "Open Media Library" menu item to `ui/src/components/menu.tsx` after "Open Folder" item
- [x] 1.2 Add `onOpenMediaLibraryMenuClick` prop to Menu component interface
- [x] 1.3 Pass handler from AppV2 to Menu component via Toolbar

## 2. Media Library Import Handler

- [x] 2.1 Create `handleOpenMediaLibraryMenuClick` function in `ui/src/AppV2.tsx`
- [x] 2.2 Implement folder selection logic (use `openNativeFileDialog` in Electron, `filePickerDialog` in web)
- [x] 2.3 Open folder type selection dialog using `openOpenFolder` after folder selection
- [x] 2.4 Call `listFiles` API with `onlyFolders: true` to enumerate subfolders in selected media library
- [x] 2.5 Implement sequential loop to process each subfolder
- [x] 2.6 Call `onFolderSelected` for each subfolder with selected media type
- [x] 2.7 Add error handling to continue processing on individual folder failures (log to console)

## 3. Integration with AppV2

- [x] 3.1 Pass `handleOpenMediaLibraryMenuClick` handler to Toolbar component
- [x] 3.2 Ensure handler has access to `onFolderSelected` from `useEventHandlers` hook
- [x] 3.3 Ensure handler has access to `openOpenFolder`, `openNativeFileDialog`, and `filePickerDialog` from `useDialogs` hook
- [x] 3.4 Ensure handler has access to `listFiles` API function

## 4. Testing

- [x] 4.1 Test menu item appears and is clickable
- [x] 4.2 Test folder selection dialog opens correctly in Electron environment
- [x] 4.3 Test folder selection dialog opens correctly in web environment
- [x] 4.4 Test folder type selection dialog opens after library folder selection
- [x] 4.5 Test all subfolders are enumerated correctly
- [x] 4.6 Test each subfolder is imported sequentially
- [x] 4.7 Test already-imported folders are skipped gracefully
- [x] 4.8 Test error handling when a folder fails to import (continues with remaining folders)
- [x] 4.9 Test with empty media library directory
- [x] 4.10 Test with library containing mixed folder types (verify all get same selected type)
