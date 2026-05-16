# download-video-format-listing

Static yt-dlp format quality presets using selector expressions (not per-video `format_id` listing).

## Requirements

### Requirement: Format quality presets use yt-dlp selector expressions

The UI SHALL offer a fixed set of format **presets** (automatic, best quality, 1080p cap, 720p cap, audio only). Each non-default preset SHALL map to a yt-dlp **format selector string** (not a per-video numeric `format_id`). The UI SHALL store the resolved string on each download job as `ytdlpFormat` for `POST /api/ytdlp/download` → `-f`.

#### Scenario: Default preset

- **WHEN** the user leaves the default preset selected
- **THEN** the job SHALL be created without `ytdlpFormat`
- **AND** each download request SHALL omit `format` on the API body

#### Scenario: 1080p preset

- **WHEN** the user selects the 1080p preset and starts download
- **THEN** each job SHALL include `ytdlpFormat` with a height-capped merge expression (e.g. `bv*[height<=1080]+ba/b[height<=1080]/best`)
- **AND** the expression SHALL apply to every URL in the batch without per-video `-F` listing

#### Scenario: No executeCmd list-formats for preset UI

- **WHEN** the user opens the format selector
- **THEN** the UI SHALL NOT call `yt-dlp -F` via executeCmd solely to populate the dropdown
- **AND** preset labels SHALL be static i18n strings
