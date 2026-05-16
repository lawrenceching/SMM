## ADDED Requirements

### Requirement: Shared whitelisted command adapters

The system SHALL provide shared frontend modules that construct `POST /api/executeCmd` request bodies (`command` + `args`) for `ffmpeg`, `ffprobe`, `yt-dlp`, and `videocaptioner` operations currently served by dedicated routes. React code and `download-service-worker.js` SHALL use these adapters instead of calling removed `/api/ffmpeg/*`, `/api/ytdlp/*`, or `/api/videocaptioner/*` endpoints.

#### Scenario: Download adapter builds yt-dlp invocation

- **WHEN** a caller requests a video download with URL, output folder, allow-listed extra args, and optional format selector
- **THEN** the adapter returns `{ command: "yt-dlp", args: [...] }` equivalent to the former download route invocation including `-f` when format is set

#### Scenario: VideoCaptioner pipeline adapter builds subcommand args

- **WHEN** a caller requests transcribe, translate, synthesize, or process with the same logical fields as the former JSON APIs
- **THEN** the adapter returns `{ command: "videocaptioner", args: [...] }` matching the CLI flag mapping previously implemented in `apps/cli`

### Requirement: Stream-to-completion helper for background jobs

The system SHALL expose a helper used by the Service Worker that invokes `executeCmdStream`, consumes NDJSON until a terminal `system` message, and returns `{ success, error?, executionId?, logRelativePath? }` suitable for IndexedDB job status updates.

#### Scenario: Successful command completion

- **WHEN** the stream ends with `system.event === "exit"` and code `0`
- **THEN** the helper resolves with `success: true` and correlation ids read from response headers when present

#### Scenario: Failed command completion

- **WHEN** the stream ends with non-zero exit or `system.event === "error"`
- **THEN** the helper resolves with `success: false` and an `error` string derived from stderr and/or system message

### Requirement: Tool availability probe via executeCmd

The system SHALL determine whether a whitelisted binary is available by attempting a read-only `executeCmd` invocation (e.g. `--version`) and treating `executable not found` or equivalent failure as unavailable. The system SHALL NOT require `GET /api/ffmpeg/discover`, `GET /api/ytdlp/discover`, or `GET /api/videocaptioner/discover`.

#### Scenario: yt-dlp available

- **WHEN** executeCmd resolves `yt-dlp` and `--version` exits successfully
- **THEN** the probe reports the tool as available

#### Scenario: videocaptioner missing

- **WHEN** executeCmd returns an error indicating the videocaptioner executable was not found
- **THEN** the probe reports VideoCaptioner as unavailable without calling a discover route
