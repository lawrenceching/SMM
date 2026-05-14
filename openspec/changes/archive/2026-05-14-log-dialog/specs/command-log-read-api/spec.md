## ADDED Requirements

### Requirement: Command log read API exists

The system SHALL expose an authenticated same-origin HTTP endpoint `GET /api/command-log/:executionId` that reads the UTF-8 command log file for a single CLI execution from the application log root.

#### Scenario: Successful read returns log text

- **WHEN** a client issues `GET /api/command-log/:executionId` with `executionId` equal to a UUID v4 that matches an on-disk directory `commands/<executionId>/main.log` under `getLogDir()`
- **THEN** the response status is `200`
- **AND** the response body contains the file contents (default `text/plain; charset=utf-8` unless `format=segments` requests JSON segmentation)
- **AND** response headers or body metadata indicate total size and whether the payload was truncated when a configured maximum is exceeded

#### Scenario: Invalid execution id is rejected

- **WHEN** `executionId` is missing or does not match the enforced UUID v4 pattern
- **THEN** the response status is `400`
- **AND** no filesystem path outside the intended commands directory is consulted

#### Scenario: Missing log yields not found

- **WHEN** `executionId` is valid but no `main.log` exists yet for that id
- **THEN** the response status is `404`

#### Scenario: Path traversal is impossible

- **WHEN** any resolved absolute path would escape `<getLogDir()>/commands/<executionId>/`
- **THEN** the request is rejected with `400` without reading the file

### Requirement: Command log API supports bounded reads

The system SHALL support query parameters (or equivalent) to read a byte range of `main.log` and to return either raw text or JSON segments derived from `--- stream=stdout|stderr|system ts=... ---` markers.

#### Scenario: Range read honors limits

- **WHEN** the client supplies `offset` and `limit` within documented bounds
- **THEN** the returned payload corresponds to that slice of the file
- **AND** the server does not read the entire file into memory when the slice is small

#### Scenario: Segments format returns ordered chunks

- **WHEN** the client requests `format=segments` and the log contains recognized stream headers
- **THEN** the JSON payload lists segments in file order each with kind, timestamp (when present), and text body
