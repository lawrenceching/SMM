# sidebar-batch-delete-media-folder Specification (Delta)

## ADDED Requirements

### Requirement: User can delete selected folder(s) with DELETE key
The system SHALL allow the user to remove the currently selected media folder(s) from the library by pressing the DELETE key when focus is in the sidebar media folder list. The same per-folder delete logic SHALL be used (remove from metadata, update user config). Single selection removes one folder; multiple selection removes all selected folders.

#### Scenario: DELETE removes single selected folder
- **WHEN** focus is within the sidebar media folder list and exactly one folder is selected
- **AND** user presses the DELETE key
- **THEN** that folder is removed from the library (metadata removed, user config updated to exclude that folder)
- **THEN** selection is cleared or updated so the deleted folder is no longer selected

#### Scenario: DELETE removes all selected folders
- **WHEN** focus is within the sidebar media folder list and multiple folders are selected
- **AND** user presses the DELETE key
- **THEN** all selected folders are removed from the library (same per-folder logic applied to each)
- **THEN** selection is updated so deleted folders are no longer selected; primary is updated if the primary was deleted

#### Scenario: DELETE does not steal focus from search
- **WHEN** focus is in the sidebar search input (or another text field)
- **AND** user presses DELETE
- **THEN** the key is NOT handled by the sidebar list (e.g., character deletion in the input occurs as normal)
- **THEN** no folders are deleted

### Requirement: Context menu Delete removes all selected folders
The system SHALL allow the user to remove all currently selected media folders from the library via the context menu Delete item. When one folder is selected, that folder is deleted (existing behavior). When multiple folders are selected, all selected folders SHALL be deleted.

#### Scenario: Context menu Delete with single selection
- **WHEN** exactly one folder is selected and user opens the context menu on a folder and clicks Delete
- **THEN** that folder is removed from the library (metadata removed, user config updated)
- **THEN** behavior matches existing single-folder delete

#### Scenario: Context menu Delete with multiple selection
- **WHEN** multiple folders are selected and user opens the context menu (on any folder) and clicks Delete
- **THEN** all selected folders are removed from the library (same per-folder logic applied to each)
- **THEN** selection is updated so deleted folders are no longer selected; primary is updated if the primary was deleted

### Requirement: Batch delete reuses existing per-folder delete logic
The system SHALL apply the same delete logic used for a single folder when deleting multiple folders: remove each folder from media metadata and update user config to exclude all deleted folder paths in one config update where applicable.

#### Scenario: Same effect as single-folder delete per path
- **WHEN** batch delete is performed for one or more paths
- **THEN** for each path, the system removes that folder from media metadata (same as existing handleDeleteButtonClick)
- **THEN** user config folders list is updated to exclude all deleted paths (e.g., one setUserConfig with filtered list)
