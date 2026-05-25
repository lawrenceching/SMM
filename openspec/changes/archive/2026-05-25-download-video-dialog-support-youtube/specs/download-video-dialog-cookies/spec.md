## MODIFIED Requirements

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

## ADDED Requirements

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
