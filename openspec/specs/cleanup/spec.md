# cleanup Specification

## Purpose
TBD - created by archiving change add-cleanup-feature. Update Purpose after archive.
## Requirements
### Requirement: Clean Up User Data
The system SHALL provide a mechanism for developers to clean up user configuration and media metadata cache.

#### Scenario: Clean up via UI menu
- **WHEN** user clicks "Clean Up" menu item in the UI
- **THEN** the system calls the clean-up debug API
- **AND** the user config file is deleted
- **AND** the media metadata cache directory is deleted
- **AND** the user is notified of the operation result

#### Scenario: Clean up via debug API
- **WHEN** developer sends POST request to `/debug` with `name: "cleanUp"`
- **THEN** the system deletes the user config file at the path returned by `getUserConfigPath()`
- **AND** the system deletes all files in the media metadata cache directory at `mediaMetadataDir`
- **AND** the API returns success status with operation details

#### Scenario: Clean up handles missing files gracefully
- **WHEN** clean-up operation is triggered
- **AND** user config file does not exist
- **THEN** the system continues with metadata cache cleanup
- **AND** no error is reported for missing config file

#### Scenario: Clean up handles missing metadata directory gracefully
- **WHEN** clean-up operation is triggered
- **AND** media metadata cache directory does not exist
- **THEN** the system continues with config file cleanup
- **AND** no error is reported for missing metadata directory

