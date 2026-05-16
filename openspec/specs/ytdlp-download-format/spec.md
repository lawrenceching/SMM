# ytdlp-download-format

Optional `format` field on yt-dlp download API for passing `-f` selector expressions.
## Requirements
### Requirement: Download accepts optional format selector

The system SHALL apply optional yt-dlp **`-f`** format selector strings when downloading via **`POST /api/executeCmd`** with `command: "yt-dlp"`. Download job data MAY include a `format` (or `ytdlpFormat`) string; when present and non-empty, the client adapter SHALL include **`-f`** with that value in the `args` array together with existing output-path, ffmpeg-location, and allow-listed extra args. When omitted or empty, download behavior SHALL match the pre-change default.

#### Scenario: Download with explicit format

- **WHEN** the client runs a download through executeCmd with a format selector (e.g. `bestvideo[height<=1080]+bestaudio`)
- **THEN** the yt-dlp invocation SHALL include `-f` with that value for the given URL
- **AND** success or failure SHALL be determined from process exit and stdout/stderr parsing consistent with prior download behavior

#### Scenario: Download without format

- **WHEN** the client runs a download without a format field
- **THEN** the system SHALL NOT pass `-f` to yt-dlp
- **AND** SHALL preserve existing default format selection behavior

#### Scenario: Format does not bypass args allow-list

- **WHEN** the client supplies disallowed values only via legacy extra-args arrays
- **THEN** the adapter SHALL continue to reject or strip arguments outside the allow-list
- **AND** format selection SHALL only be accepted via the dedicated format field on the job/request

