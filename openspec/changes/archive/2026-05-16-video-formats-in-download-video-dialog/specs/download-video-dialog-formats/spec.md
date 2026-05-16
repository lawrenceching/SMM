## ADDED Requirements

### Requirement: Dialog shows format presets when URL is valid

`DownloadVideoDialog` SHALL show a format preset control when the user has agreed to terms and the URL passes `validateDownloadUrl`. The control SHALL NOT depend on loading formats from the first video in a batch.

#### Scenario: Single video URL

- **WHEN** the user enters a valid single-video URL and has agreed to the download terms
- **THEN** the dialog SHALL show the preset selector immediately (no async format list)
- **AND** the user SHALL be able to start download without waiting for `-F`

#### Scenario: Multiple episodes or collection videos

- **WHEN** the user enables episode or collection download and selects items to download
- **THEN** the dialog SHALL show the same preset selector
- **AND** the chosen preset expression SHALL apply to every enqueued job

### Requirement: Format selector UX

The dialog SHALL provide a preset control with a default option representing yt-dlp’s automatic selection (no `format` sent on download). The Download action SHALL NOT be blocked by format listing.

#### Scenario: Successful interaction

- **WHEN** the URL is valid and other validation passes
- **THEN** the user SHALL be able to choose any preset and start download

### Requirement: Selected format applies to the entire job

When the user confirms download, the created `download-video` background job SHALL store the chosen preset’s format expression (if any) on job data. The download Service Worker SHALL pass that value on **every** `POST /api/ytdlp/download` call for videos in the job.

#### Scenario: Multi-video job uses one expression

- **WHEN** the user downloads multiple episode or collection URLs with the 1080p preset selected
- **THEN** the job data SHALL record `ytdlpFormat` with the 1080p expression string
- **AND** each per-video download request in the job SHALL include the same `format` value

#### Scenario: Default format for job

- **WHEN** the user leaves the default preset selected
- **THEN** the job SHALL be created without a format field (or with empty format)
- **AND** each per-video download SHALL omit `format` on the API request
