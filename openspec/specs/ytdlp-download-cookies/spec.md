# ytdlp-download-cookies

Optional cookies file path and browser profile for yt-dlp download via executeCmd.

## Requirements

### Requirement: Download accepts optional cookies file path

The system SHALL pass yt-dlp **`--cookies`** when downloading via **`POST /api/executeCmd`** with `command: "yt-dlp"`. Download job data MAY include `ytdlpCookiesFile` (absolute path to a Netscape-format cookie file). When present and non-empty, `buildYtdlpDownloadArgs` SHALL append **`--cookies`** and that path to the `args` array. When omitted or empty, download behavior SHALL match the pre-change default (no `--cookies`).

#### Scenario: Download with cookies file

- **WHEN** the client runs a download through executeCmd with `cookiesFile` set to a valid path
- **THEN** the yt-dlp invocation SHALL include `--cookies` with that path before the URL argument
- **AND** success or failure SHALL be determined from process exit and stdout/stderr parsing consistent with prior download behavior

#### Scenario: Download without cookies

- **WHEN** the client runs a download without a cookies file path
- **THEN** the system SHALL NOT pass `--cookies` to yt-dlp

#### Scenario: Cookies path does not bypass args allow-list

- **WHEN** a caller attempts to pass `--cookies` only through the legacy extra-args array
- **THEN** the adapter SHALL continue to reject or strip disallowed arguments
- **AND** cookies SHALL only be accepted via the dedicated `cookiesFile` field on the download input

#### Scenario: Batch job reuses one cookies file per job

- **WHEN** a download-video job includes multiple videos and `ytdlpCookiesFile` on job data
- **THEN** each per-video executeCmd invocation SHALL use the same `ytdlpCookiesFile` path

### Requirement: Download accepts optional cookies-from-browser profile

The system SHALL pass yt-dlp **`--cookies-from-browser`** when downloading via executeCmd. Download job data MAY include `ytdlpCookiesFromBrowser` with a supported profile name (`chrome`, `edge`, or `firefox`). When present and non-empty, `buildYtdlpDownloadArgs` SHALL append **`--cookies-from-browser`** and that value to the `args` array.

#### Scenario: Download with browser cookies

- **WHEN** the client runs a download with `cookiesFromBrowser` set to `chrome`
- **THEN** the yt-dlp invocation SHALL include `--cookies-from-browser` and `chrome`

#### Scenario: Download without browser cookies

- **WHEN** the client runs a download without `cookiesFromBrowser`
- **THEN** the system SHALL NOT pass `--cookies-from-browser` to yt-dlp

#### Scenario: Cookies file and browser cookies may be combined

- **WHEN** the client supplies both `cookiesFile` and `cookiesFromBrowser`
- **THEN** the yt-dlp invocation SHALL include both `--cookies` and `--cookies-from-browser` in the args array

### Requirement: Managed cookies temp files are permanently deleted after use

The system SHALL treat SMM-written yt-dlp cookie files under `{userDataDir}/temp/ytdlp-cookies-*.txt` as sensitive ephemeral data. After yt-dlp finishes using such a file, the system SHALL permanently delete it via `POST /api/deleteFile` (not `moveFileToTrash`).

#### Scenario: List-formats command deletes cookies after run

- **WHEN** the UI runs `yt-dlp -J` (or equivalent inspect command) with a managed `cookiesFile`
- **THEN** the cookies file SHALL be permanently deleted when the command completes (success or failure)

#### Scenario: Download job deletes cookies once after job finishes

- **WHEN** a download-video background job used `ytdlpCookiesFile` for one or more yt-dlp download invocations
- **THEN** the cookies file SHALL be permanently deleted exactly once when the job reaches a terminal status (`succeeded`, `failed`, or `stopped`)
- **AND** the file SHALL NOT be deleted between per-video downloads in a batch job

#### Scenario: deleteFile rejects non-managed paths

- **WHEN** a client calls `POST /api/deleteFile` with a path outside `{userDataDir}/temp/ytdlp-cookies-*.txt`
- **THEN** the API SHALL reject the request and SHALL NOT delete the file
