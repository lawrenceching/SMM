## Context

The application currently supports importing individual media folders through the "Open Folder" menu item. The workflow involves:
1. User clicks "Open Folder" menu item
2. File dialog opens (native in Electron, file picker in web)
3. User selects a folder
4. Folder type selection dialog opens (tvshow/movie/music)
5. `onFolderSelected` handler processes the folder and adds it to the media metadata collection

The existing `onFolderSelected` handler in `ui/src/hooks/eventhandlers/onFolderSelected.ts` handles:
- Reading existing metadata or creating initial metadata
- Listing files in the folder
- Attempting to recognize media from NFO files
- Adding/updating metadata in the collection

The `listFiles` API supports listing directories with `onlyFolders: true` option, which can enumerate all subfolders in a media library directory.

## Goals / Non-Goals

**Goals:**
- Enable bulk import of all media folders within a selected media library directory
- Reuse existing single-folder import infrastructure (`onFolderSelected`) for consistency
- Maintain the same folder type selection workflow (user selects one type that applies to all folders)
- Support both Electron (native dialog) and web (file picker) environments
- Handle errors gracefully - continue importing other folders if one fails

**Non-Goals:**
- Parallel import of folders (sequential processing to avoid overwhelming the system)
- Progress UI for batch import (can be added in future iteration)
- Filtering or selection of specific folders within the library (imports all subfolders)
- Recursive library structure (only processes immediate subfolders, not nested libraries)

## Decisions

### 1. Sequential vs Parallel Folder Import
**Decision**: Process folders sequentially, one at a time.

**Rationale**: 
- Prevents overwhelming the system with concurrent API calls and file operations
- Easier error handling and debugging
- Maintains predictable behavior
- Can be optimized to parallel processing in future if needed

**Alternatives Considered**:
- Parallel processing with concurrency limit: More complex error handling, potential race conditions
- Batch API calls: Would require new API endpoint, breaks single-folder reuse pattern

### 2. Error Handling Strategy
**Decision**: Continue importing remaining folders if one fails, log errors to console.

**Rationale**:
- User shouldn't lose progress if one folder has issues
- Console logging provides debugging information
- Matches existing error handling patterns in `onFolderSelected`

**Alternatives Considered**:
- Stop on first error: Too strict, user loses all progress
- Show error dialog for each failure: Too disruptive for batch operations

### 3. Folder Type Selection Dialog Reuse
**Decision**: Reuse existing `openOpenFolder` dialog without modification.

**Rationale**:
- Dialog already shows folder path, works for both single folder and library context
- No UI changes needed - user selects type once for all folders
- Maintains consistency with existing workflow

**Alternatives Considered**:
- Create separate dialog for media library: Unnecessary duplication, breaks consistency

### 4. Handling Already-Imported Folders
**Decision**: Call `onFolderSelected` for all folders, let existing handler skip duplicates.

**Rationale**:
- `onFolderSelected` already checks if folder exists in metadata collection
- Existing logic handles this case appropriately
- Keeps implementation simple and consistent

**Alternatives Considered**:
- Pre-filter folders before calling `onFolderSelected`: Adds complexity, duplicates existing logic

### 5. Menu Item Placement
**Decision**: Add "Open Media Library" menu item directly after "Open Folder" in the SMM menu.

**Rationale**:
- Logical grouping with related functionality
- Clear distinction from single folder import
- Follows existing menu structure

## Risks / Trade-offs

**[Risk] Performance with large libraries**: Importing hundreds of folders sequentially could take significant time.
- **Mitigation**: Sequential processing prevents system overload. Future enhancement could add progress indicator and cancellation.

**[Risk] User confusion if folder type is wrong**: If user selects wrong type, all folders get wrong type.
- **Mitigation**: Dialog clearly shows this applies to all folders. User can manually change type per folder after import if needed.

**[Risk] Silent failures**: If a folder fails to import, user may not notice.
- **Mitigation**: Errors logged to console. Future enhancement could add toast notifications or summary dialog.

**[Trade-off] No progress feedback**: User doesn't see progress during batch import.
- **Acceptable for MVP**: Console logs provide visibility. Can add progress UI in future iteration.

**[Trade-off] Only immediate subfolders**: Doesn't handle nested library structures.
- **Acceptable for MVP**: Covers common use case. Can add recursive option in future if needed.

## Migration Plan

**Deployment Steps:**
1. Add menu item to `ui/src/components/menu.tsx`
2. Add handler function to `ui/src/AppV2.tsx`
3. Test in both Electron and web environments
4. Verify error handling with problematic folders

**Rollback Strategy:**
- Remove menu item and handler function
- No data migration needed (uses existing metadata structure)
- No API changes (reuses existing endpoints)

**Testing Considerations:**
- Test with empty media library directory
- Test with library containing already-imported folders
- Test with library containing folders that fail to import
- Test with large library (50+ folders) for performance
- Test in both Electron and web environments

## Open Questions

None - design is straightforward and reuses existing infrastructure.
