## ADDED Requirements

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

#### Scenario: Batch job reuses one cookies file

- **WHEN** a download-video job includes multiple videos and `ytdlpCookiesFile` on job data
- **THEN** each per-video executeCmd invocation SHALL use the same `ytdlpCookiesFile` path
