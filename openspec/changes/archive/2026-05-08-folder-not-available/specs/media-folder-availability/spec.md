# media-folder-availability

Runtime detection that configured media folder paths are reachable on the host filesystem, and UI behavior when they are not.

## ADDED Requirements

### Requirement: Folder availability API

The CLI SHALL expose an HTTP API that reports whether a given filesystem path exists, is accessible, and refers to a directory (including a symlink whose target is a directory).

#### Scenario: Available directory

- **WHEN** the client sends `POST /api/isFolderAvailable` with a JSON body containing the configured folder path for an existing accessible directory
- **THEN** the server SHALL respond with success and a body indicating the folder is available

#### Scenario: Missing or inaccessible path

- **WHEN** the client sends `POST /api/isFolderAvailable` with a JSON body containing a path that does not exist, is not a directory, or cannot be accessed
- **THEN** the server SHALL respond with success and a body indicating the folder is not available

#### Scenario: Invalid request

- **WHEN** the client sends a malformed body or omits the path
- **THEN** the server SHALL respond with an appropriate client error and SHALL NOT throw an unhandled exception

### Requirement: UI marks unavailable folders after config load

The UI SHALL verify each configured media folder path against the folder availability API during initialization of the UI media folder store (after paths are known from persisted user config).

#### Scenario: Unavailable path updates status

- **WHEN** the availability API reports that a configured folder path is not available
- **THEN** the UI SHALL set that folder’s `UIMediaFolder` status to `folder_not_found`

#### Scenario: Available path does not force not-found

- **WHEN** the availability API reports that a configured folder path is available
- **THEN** the UI SHALL NOT leave that folder in `folder_not_found` solely based on that check

### Requirement: Folder-not-available panel replaces primary content

The UI SHALL show a dedicated folder-not-available view when the selected media folder’s status is `folder_not_found`, instead of the Tv show, Movie, Music, or local file content panels.

#### Scenario: Selected folder is unavailable

- **WHEN** the user selects a media folder whose status is `folder_not_found`
- **THEN** the main content area SHALL render the folder-not-available panel and SHALL NOT render the type-specific media panels for that selection

#### Scenario: Selected folder becomes available

- **WHEN** the user selects a media folder whose status is not `folder_not_found`
- **THEN** the UI SHALL follow existing rules for showing Tv show, Movie, Music, or local file panels
