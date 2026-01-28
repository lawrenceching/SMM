## ADDED Requirements

### Requirement: User can import media library
The system SHALL provide a menu item "Open Media Library" that allows users to select a media library folder and import all media folders within it.

#### Scenario: User imports media library from menu
- **WHEN** user clicks "Open Media Library" menu item
- **THEN** system opens file selection dialog (native dialog in Electron, file picker in web)
- **THEN** user can select a folder containing multiple media folders
- **THEN** system opens folder type selection dialog (tvshow/movie/music)
- **THEN** user selects a media type that applies to all folders in the library
- **THEN** system imports all subfolders in the selected media library directory

#### Scenario: System enumerates media folders in library
- **WHEN** user has selected a media library folder and media type
- **THEN** system calls listFiles API with `onlyFolders: true` to get all subfolders
- **THEN** system processes each subfolder as a media folder

#### Scenario: System imports each media folder sequentially
- **WHEN** system has enumerated all media folders in the library
- **THEN** system calls `onFolderSelected` handler for each folder sequentially
- **THEN** each folder is processed using existing single-folder import logic
- **THEN** all folders share the same media type selected by the user

#### Scenario: System handles already-imported folders
- **WHEN** system attempts to import a folder that already exists in media metadata collection
- **THEN** existing `onFolderSelected` handler logic skips the duplicate folder
- **THEN** system continues processing remaining folders

#### Scenario: System handles import errors gracefully
- **WHEN** a folder fails to import during batch processing
- **THEN** system logs error to console
- **THEN** system continues processing remaining folders
- **THEN** successfully imported folders remain in the collection

#### Scenario: System supports both Electron and web environments
- **WHEN** user clicks "Open Media Library" in Electron environment
- **THEN** system uses native file dialog (`openNativeFileDialog`)
- **WHEN** user clicks "Open Media Library" in web environment
- **THEN** system uses file picker dialog (`filePickerDialog`)
