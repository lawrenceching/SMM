# Spec: rename-files-api (delta)

Delta spec for the add-rename-files-api-v2 change.

## ADDED Requirements

### Requirement: RenameFiles endpoint contract

The system SHALL expose `POST /api/renameFiles` that accepts a JSON body with a batch of file renames and an optional trace id, uses platform-specific paths, performs no media metadata update or `mediaMetadataUpdated` broadcast, and returns which renames succeeded and which failed.

#### Scenario: Request and response shape

- **WHEN** a client sends `POST /api/renameFiles` with a body `{ files: [ { from: "<path>", to: "<path>" }, ... ], traceId?: "<string>" }` where `from` and `to` are in platform-specific format (POSIX on Linux/macOS, Windows format on Windows)
- **THEN** the server processes the request and responds with HTTP 200 and a JSON body of the form `{ data?: { succeeded: string[], failed: { path: string, error: string }[] }, error?: string }`; business logic failures use the `error` field, and per-rename results use `data.succeeded` and `data.failed`

#### Scenario: Optional traceId

- **WHEN** a client includes `traceId` in the request body
- **THEN** the server MAY use it for logging or correlation but SHALL NOT change validation or rename behavior based on it

### Requirement: Validation of from paths against media folders

The system SHALL reject or exclude any rename whose `from` path is not under one of the opened media folders in `userConfig.folders`.

#### Scenario: From path outside all media folders

- **WHEN** a client sends a rename with `from` that is not under any of `userConfig.folders`
- **THEN** that rename SHALL be reported in `data.failed` with an error indicating the path is outside allowed media folders (or the whole request SHALL return `error` if the contract treats that as a global validation failure)

#### Scenario: From path under a media folder

- **WHEN** a client sends a rename with `from` under one of `userConfig.folders`
- **THEN** that `from` SHALL pass this validation rule (subject to other rules such as same-directory and file existence)

### Requirement: Validation of to path same directory as from

The system SHALL reject or exclude any rename whose `to` path is not in the same directory as its `from` path, so that files cannot be moved to another folder via this API.

#### Scenario: To path in a different directory

- **WHEN** a client sends a rename with `to` in a different directory than `from`
- **THEN** that rename SHALL be reported in `data.failed` with an error indicating the destination must be in the same folder as the source

#### Scenario: To path in same directory as from

- **WHEN** a client sends a rename with `to` in the same directory as `from`
- **THEN** that pair SHALL pass this validation rule (subject to other rules)

### Requirement: No metadata update or broadcast

The system SHALL NOT update media metadata and SHALL NOT emit a `mediaMetadataUpdated` event when handling `POST /api/renameFiles`.

#### Scenario: No broadcast after renames

- **WHEN** one or more renames are successfully performed via `POST /api/renameFiles`
- **THEN** the server SHALL NOT emit `mediaMetadataUpdated` and SHALL NOT write or update media metadata for the renamed paths as part of this request

### Requirement: Per-rename success and failure reporting

The system SHALL return for each attempted rename whether it succeeded or failed, and for failures SHALL include the path and an error message.

#### Scenario: All renames succeed

- **WHEN** all requested renames are valid and execute successfully
- **THEN** the response SHALL have `data.succeeded` containing the `from` paths (or the paths that were renamed) that succeeded, and `data.failed` SHALL be an empty array

#### Scenario: Some renames fail

- **WHEN** some renames succeed and some fail (e.g. validation or filesystem error)
- **THEN** the response SHALL have `data.succeeded` with the successful paths and `data.failed` with one entry per failed rename, each including `path` and `error`

#### Scenario: Request-level error

- **WHEN** the request body is invalid or a top-level validation fails (e.g. missing `files`)
- **THEN** the response SHALL use the `error` field to describe the failure and MAY omit or leave `data` undefined as per existing API conventions
