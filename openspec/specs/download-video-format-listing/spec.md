# download-video-format-listing

Static yt-dlp format quality presets using selector expressions (not per-video `format_id` listing).

## Purpose

Define how yt-dlp format presets are resolved to selector expressions, and how per-video format codes from `--list-formats` populate the format code dropdown.
## Requirements
### Requirement: Format quality presets use yt-dlp selector expressions

The UI SHALL offer a fixed set of format **presets** (automatic, best quality, 1080p cap, 720p cap, audio only). In addition, after successful `--list-formats`, the UI SHALL offer **format code** mode populated from the per-video format IDs.

Each non-default preset SHALL map to a yt-dlp **format selector string** (not a per-video numeric `format_id`). Each format code selection SHALL map to the format ID(s) from `--list-formats` output.

The UI SHALL store the resolved format string on each download job as `ytdlpFormat` for **`POST /api/executeCmd`** (`command: "yt-dlp"`) via the download adapter, not for `POST /api/ytdlp/download`.

#### Scenario: Preset stored on job

- **WHEN** the user selects the 1080p cap preset and confirms download
- **THEN** the job record contains the mapped format expression string
- **AND** the Service Worker passes that string into the executeCmd download adapter as `-f`

#### Scenario: Format code stored on job

- **WHEN** the user selects format code "18" (combined audio+video) and confirms download
- **THEN** the job record contains `"18"` as `ytdlpFormat`
- **AND** the Service Worker passes it as `-f "18"`

#### Scenario: Audio+video format code pairing stored on job

- **WHEN** the user selects audio-only format "140" and supplementary video format "136"
- **THEN** the job record contains `"136+140"` as `ytdlpFormat`
- **AND** the Service Worker passes it as `-f "136+140"`

### Requirement: Format listing is triggered manually by Go button or Enter key

The `--list-formats` call SHALL be triggered only when the user clicks the "Go" button or presses Enter in the URL input field. URL blur SHALL NOT trigger format listing.

#### Scenario: User clicks Go

- **WHEN** the user clicks the "Go" button
- **THEN** `--list-formats` SHALL be called with the current URL and cookie/JS-runtime settings

#### Scenario: User presses Enter in URL field

- **WHEN** the user presses Enter while the URL input is focused
- **THEN** `--list-formats` SHALL be called (same as clicking Go)

#### Scenario: URL blur does not trigger format listing

- **WHEN** the user tabs away from or blurs the URL input without clicking Go or pressing Enter
- **THEN** `--list-formats` SHALL NOT be called

### Requirement: Loading state shown during format listing

While `--list-formats` is executing, the "Go" button SHALL display a spinner icon in place of the "Go" text, indicating loading state. The button SHALL be disabled during this time.

#### Scenario: Loading spinner during format fetch

- **WHEN** the user clicks "Go" and `--list-formats` begins executing
- **THEN** the "Go" button text SHALL be replaced by a spinner icon
- **AND** the button SHALL be disabled

#### Scenario: Spinner removed after format fetch completes

- **WHEN** `--list-formats` completes (success or error)
- **THEN** the spinner SHALL be replaced by the "Go" text
- **AND** the button SHALL be re-enabled

### Requirement: Format listing populates format code dropdown

On successful `--list-formats`, the parsed format entries SHALL populate the format code dropdown, grouped into audio only, video only, and audio+video categories.

#### Scenario: Format codes populated from listing

- **WHEN** `--list-formats` returns format data
- **THEN** the format code dropdown SHALL be populated with all parsed format entries
- **AND** entries SHALL be grouped by category

### Requirement: Error handling applies to both list-formats and download phases

Error detection SHALL apply to both `--list-formats` output and download execution output. The same error patterns (cookie expiry, format unavailable, unknown error) SHALL be checked in both phases.

#### Scenario: Cookie expiry during list-formats

- **WHEN** `--list-formats` stderr contains "The provided YouTube account cookies are no longer valid"
- **THEN** the dialog SHALL display "Cookies 过期或无效, 请重新配置"

#### Scenario: Cookie expiry during download

- **WHEN** download execution stderr contains "The provided YouTube account cookies are no longer valid"
- **THEN** the dialog SHALL display "Cookies 过期或无效, 请重新配置"

#### Scenario: Format not available during download

- **WHEN** download execution stderr contains "Requested format is not available"
- **THEN** the dialog SHALL display "请求格式不可用, 请尝试选择格式码"

#### Scenario: Unknown error in either phase

- **WHEN** either `--list-formats` or download fails with an unrecognized error pattern
- **THEN** the dialog SHALL display "未知错误, 请从状态栏任务列表中查看详细日志"

