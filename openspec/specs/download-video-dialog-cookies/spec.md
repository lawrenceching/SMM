# download-video-dialog-cookies

Cookie options in Download Video dialog: manual paste and browser extraction.

## Requirements

### Requirement: Dialog allows cookie text entry

`DownloadVideoDialog` SHALL provide a **Configure** control that opens TextDialog for pasting Netscape/Mozilla-format cookie file content. The dialog SHALL retain the last entered cookie text for the session while the download dialog is open.

#### Scenario: Open cookie editor

- **WHEN** the user has agreed to download terms and taps **Configure**
- **THEN** TextDialog SHALL open with the current cookie text (if any)
- **AND** confirming SHALL update the stored cookie text in DownloadVideoDialog state

### Requirement: Use cookies checkbox gates manual cookie file

The dialog SHALL provide a **Use cookies** checkbox. When unchecked, the system SHALL NOT write a cookie file and SHALL NOT set `ytdlpCookiesFile` on the job regardless of stored text.

#### Scenario: Manual cookies disabled

- **WHEN** the user starts download with **Use cookies** unchecked
- **THEN** the job SHALL be created without `ytdlpCookiesFile`
- **AND** yt-dlp SHALL run without `--cookies` from a file path

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
- **THEN** the job SHALL include both `ytdlpFormat` (if any) and `ytdlpCookiesFile` when manual cookies are enabled
- **AND** each download invocation SHALL include both `-f` (when set) and `--cookies` (when set)

### Requirement: Dialog allows cookies-from-browser

The dialog SHALL provide a **From browser** checkbox and a browser selector (Chrome, Edge, Firefox). When enabled, the job SHALL store the selected profile on `ytdlpCookiesFromBrowser`. Manual cookies and browser cookies MAY be enabled together.

#### Scenario: Browser cookies enabled

- **WHEN** the user enables **From browser** and starts download
- **THEN** the job SHALL include `ytdlpCookiesFromBrowser` with the selected browser id
- **AND** the Service Worker SHALL pass it to the download adapter as `--cookies-from-browser`

#### Scenario: Both cookie modes enabled

- **WHEN** the user enables **Use cookies** with non-empty text and **From browser**
- **THEN** the job MAY include both `ytdlpCookiesFile` and `ytdlpCookiesFromBrowser`
- **AND** yt-dlp SHALL receive both `--cookies` and `--cookies-from-browser`
