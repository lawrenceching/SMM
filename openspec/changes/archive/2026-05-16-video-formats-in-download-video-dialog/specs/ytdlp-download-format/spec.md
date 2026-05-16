## ADDED Requirements

### Requirement: Download accepts optional format selector

The system SHALL extend **`POST /api/ytdlp/download`** so the request body MAY include a `format` string. When `format` is present and non-empty, the yt-dlp invocation SHALL pass **`-f`** with that value in addition to existing output-path, ffmpeg-location, and allow-listed `args` behavior. When `format` is omitted or empty, download behavior SHALL match the pre-change default.

#### Scenario: Download with explicit format

- **WHEN** the client posts a valid download request with `format` set to a yt-dlp format id (e.g. `137`)
- **THEN** the CLI SHALL invoke yt-dlp with `-f` and that value for the given URL
- **AND** SHALL return success or failure consistent with existing download responses

#### Scenario: Download without format

- **WHEN** the client posts a valid download request without `format`
- **THEN** the system SHALL NOT pass `-f` to yt-dlp
- **AND** SHALL preserve existing default format selection behavior

#### Scenario: Format does not bypass args allow-list

- **WHEN** the client supplies disallowed values only via the legacy `args` array
- **THEN** the system SHALL continue to reject requests that include arguments outside the allow-list
- **AND** format selection SHALL only be accepted via the dedicated `format` field
