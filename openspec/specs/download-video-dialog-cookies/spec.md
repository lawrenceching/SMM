# download-video-dialog-cookies

Cookie options in Download Video dialog: manual paste and browser extraction.

## Purpose

Provide cookie configuration (manual paste and browser extraction) for authenticated video downloads via yt-dlp's `--cookies` and `--cookies-from-browser` flags.
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

The dialog SHALL provide a **From browser** checkbox and a browser selector. On Windows (`win32`), the browser selector SHALL only list Firefox. On macOS and Linux, the browser selector SHALL list Chrome, Edge, and Firefox. When enabled, the job SHALL store the selected profile on `ytdlpCookiesFromBrowser`. Manual cookies and browser cookies MAY be enabled together.

#### Scenario: Browser cookies enabled on Windows

- **WHEN** the user on Windows enables **From browser** and starts download
- **THEN** the browser selector SHALL only show Firefox
- **AND** the job SHALL include `ytdlpCookiesFromBrowser` with the selected browser id
- **AND** the Service Worker SHALL pass it to the download adapter as `--cookies-from-browser`

#### Scenario: Browser cookies enabled on macOS/Linux

- **WHEN** the user on macOS or Linux enables **From browser**
- **THEN** the browser selector SHALL list Chrome, Edge, and Firefox
- **AND** the user SHALL be able to select any of the three browsers

#### Scenario: Both cookie modes enabled

- **WHEN** the user enables **Use cookies** with non-empty text and **From browser**
- **THEN** the job MAY include both `ytdlpCookiesFile` and `ytdlpCookiesFromBrowser`
- **AND** yt-dlp SHALL receive both `--cookies` and `--cookies-from-browser`

### Requirement: Go button is disabled for YouTube without cookies

For YouTube URLs, the "Go" button SHALL be disabled if neither "使用 Cookies" nor "从浏览器获取" is checked.

#### Scenario: YouTube with no cookies selected

- **WHEN** the URL is detected as YouTube
- **AND** neither "使用 Cookies" nor "从浏览器获取" is checked
- **THEN** the "Go" button SHALL be disabled

#### Scenario: YouTube with cookies selected

- **WHEN** the URL is detected as YouTube
- **AND** at least one of "使用 Cookies" or "从浏览器获取" is checked
- **THEN** the "Go" button SHALL be enabled

#### Scenario: Non-YouTube without cookies

- **WHEN** the URL is detected as non-YouTube (e.g., Bilibili)
- **THEN** the "Go" button SHALL be enabled regardless of cookie selections

### Requirement: Cookies section moves to More Options after format fetch

After `--list-formats` succeeds, the Cookies section SHALL move from the top-level dialog layout into the "More Options" collapsible section, alongside JS Runtime and extra args.

#### Scenario: Cookies visible at top level before format fetch

- **WHEN** the dialog is in initial state (formats not yet fetched)
- **AND** the URL is YouTube
- **THEN** the Cookies section SHALL be displayed at the top level of the dialog

#### Scenario: Cookies moved to More Options after format fetch

- **WHEN** `--list-formats` completes successfully
- **THEN** the Cookies section SHALL move into the "More Options" collapsible section
- **AND** the Cookies settings SHALL retain their current values

### Requirement: Cookie dialog pre-fills from in-memory cache on URL entry

When the user enters a URL whose domain matches a cached cookie entry, the DownloadVideoDialog SHALL pre-fill the cookie fields (text, checkboxes, browser selection) from the cache without requiring the user to re-configure.

#### Scenario: YouTube URL triggers cache pre-fill

- **WHEN** the user types a YouTube URL after having previously configured cookies for youtube.com
- **THEN** the "Use cookies" checkbox SHALL be checked
- **AND** the cookie text SHALL be pre-filled with the cached content
- **AND** the "From browser" and browser selection SHALL match the cached configuration

#### Scenario: Cache pre-fill preserves user edits

- **WHEN** the cache pre-fills cookies for a domain
- **AND** the user manually edits the cookie text or unchecks a box
- **THEN** the user's edits SHALL take precedence over the cached values for the current session
