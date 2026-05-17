## ADDED Requirements

### Requirement: Dialog allows cookie text entry

`DownloadVideoDialog` SHALL provide a **Cookie** control that opens TextDialog for pasting Netscape/Mozilla-format cookie file content. The dialog SHALL retain the last entered cookie text for the session while the download dialog is open.

#### Scenario: Open cookie editor

- **WHEN** the user has agreed to download terms and taps **Cookie**
- **THEN** TextDialog SHALL open with the current cookie text (if any)
- **AND** confirming SHALL update the stored cookie text in DownloadVideoDialog state

### Requirement: Use cookies checkbox gates download behavior

The dialog SHALL provide a **Use cookies** checkbox. When unchecked, the system SHALL NOT write a cookie file and SHALL NOT set `ytdlpCookiesFile` on the job regardless of stored text.

#### Scenario: Cookies disabled

- **WHEN** the user starts download with **Use cookies** unchecked
- **THEN** the job SHALL be created without `ytdlpCookiesFile`
- **AND** yt-dlp SHALL run without `--cookies`

#### Scenario: Cookies enabled with empty text

- **WHEN** the user enables **Use cookies** but cookie text is empty or whitespace-only and starts download
- **THEN** the dialog SHALL show a validation error and SHALL NOT enqueue the job

### Requirement: Cookie file written before job enqueue

When the user confirms download with **Use cookies** enabled and non-empty cookie text, the UI SHALL write the content to a `.txt` file under the user data directory via **`POST /api/writeFile`** before creating the background job. The job SHALL store the absolute file path as `ytdlpCookiesFile`.

#### Scenario: Successful enqueue with cookies

- **WHEN** the user starts a valid download with **Use cookies** enabled and non-empty cookie text
- **THEN** the UI SHALL call writeFile with normalized line endings (LF)
- **AND** SHALL create the download-video job with `ytdlpCookiesFile` set to the written path
- **AND** the Service Worker SHALL pass that path into the executeCmd download adapter for every video in the job

#### Scenario: writeFile failure

- **WHEN** writeFile returns an error
- **THEN** the UI SHALL show an error toast
- **AND** SHALL NOT create the background job

#### Scenario: Cookies apply with format preset

- **WHEN** the user selects a format preset and enables cookies
- **THEN** the job SHALL include both `ytdlpFormat` (if any) and `ytdlpCookiesFile`
- **AND** each download invocation SHALL include both `-f` (when set) and `--cookies`
