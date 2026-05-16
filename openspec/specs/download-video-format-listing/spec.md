# download-video-format-listing

Static yt-dlp format quality presets using selector expressions (not per-video `format_id` listing).
## Requirements
### Requirement: Format quality presets use yt-dlp selector expressions

The UI SHALL offer a fixed set of format **presets** (automatic, best quality, 1080p cap, 720p cap, audio only). Each non-default preset SHALL map to a yt-dlp **format selector string** (not a per-video numeric `format_id`). The UI SHALL store the resolved string on each download job as `ytdlpFormat` for **`POST /api/executeCmd`** (`command: "yt-dlp"`) via the download adapter, not for `POST /api/ytdlp/download`.

#### Scenario: Preset stored on job

- **WHEN** the user selects the 1080p cap preset and confirms download
- **THEN** the job record contains the mapped format expression string
- **AND** the Service Worker passes that string into the executeCmd download adapter as `-f`

