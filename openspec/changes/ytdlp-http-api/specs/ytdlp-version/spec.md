## ADDED Requirements

### Requirement: Get yt-dlp version
The system SHALL return the version of yt-dlp by executing `yt-dlp --version`.

#### Scenario: yt-dlp found and version retrieved
- **WHEN** yt-dlp executable is discovered and `--version` command succeeds
- **THEN** API returns HTTP 200 with `{ "version": "<version-string>" }`

#### Scenario: yt-dlp executable not found
- **WHEN** yt-dlp executable cannot be discovered
- **THEN** API returns HTTP 200 with `{ "error": "yt-dlp executable not found" }`

#### Scenario: yt-dlp command execution failed
- **WHEN** yt-dlp executable is found but `--version` command fails
- **THEN** API returns HTTP 200 with `{ "error": "failed to execute yt-dlp" }`

### Requirement: HTTP response status
The system SHALL always return HTTP 200 for this endpoint regardless of business logic result.

#### Scenario: Any outcome
- **WHEN** any of the above scenarios occur
- **THEN** HTTP status code is always 200
