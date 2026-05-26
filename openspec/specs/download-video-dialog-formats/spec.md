# download-video-dialog-formats

Format preset selection in Download Video dialog; chosen expression applies to entire download jobs including batch episodes and collections.

## Purpose

Allow users to select video quality via presets or format codes when downloading videos, applying the chosen format selector across all videos in a job.
## Requirements
### Requirement: Dialog shows format presets when URL is valid

`DownloadVideoDialog` SHALL show a format preset control after the user has successfully fetched video formats via the "Go" button. The control SHALL also show a radio group allowing the user to switch between "预设" (presets) and "格式码" (format codes from `yt-dlp -J` output).

#### Scenario: Single video URL after format fetch

- **WHEN** the user clicks "Go" and `yt-dlp -J` succeeds for a single video
- **THEN** the dialog SHALL show the format radio group (预设 / 格式码)
- **AND** "预设" SHALL be selected by default
- **AND** the preset dropdown SHALL be visible

#### Scenario: Multiple episodes or collection videos

- **WHEN** the user enables episode or collection download and selects items to download
- **THEN** the dialog SHALL show only the preset dropdown
- **AND** the format radio group SHALL NOT be visible
- **AND** the chosen preset expression SHALL apply to every enqueued job

### Requirement: Format selector UX

The dialog SHALL provide a preset control with a default option representing yt-dlp's automatic selection. The format radio group SHALL allow switching between preset and format code modes. The Download action SHALL NOT be blocked by format listing.

#### Scenario: Successful interaction

- **WHEN** formats have been fetched and other validation passes
- **THEN** the user SHALL be able to choose any preset, or switch to format code mode and select a format code
- **AND** the user SHALL be able to start download

### Requirement: Selected format applies to the entire job

When the user confirms download, the created `download-video` background job SHALL store the chosen preset's format expression (if any) on job data. The download Service Worker SHALL pass that value into the **executeCmd yt-dlp download adapter** for **every** video in the job, not via `POST /api/ytdlp/download`.

#### Scenario: Multi-video job uses one expression

- **WHEN** the user downloads multiple episode or collection URLs with the 1080p preset selected
- **THEN** the job data SHALL record `ytdlpFormat` with the 1080p expression string
- **AND** each per-video executeCmd invocation SHALL include the same format expression from job data

#### Scenario: Default format for job

- **WHEN** the user leaves the default preset selected
- **THEN** the job SHALL be created without a format field (or with empty format)
- **AND** each per-video executeCmd download SHALL omit `-f` in yt-dlp args

### Requirement: Format radio group is hidden during episodes or collection download

When episode download or collection download is active, the format radio group (预设/格式码) and all format code dropdowns SHALL be hidden. Only the preset dropdown SHALL remain visible.

#### Scenario: Episodes mode hides radio group

- **WHEN** the user enables episode download
- **THEN** the format radio group SHALL be hidden
- **AND** the preset dropdown SHALL remain visible

#### Scenario: Collection mode hides radio group

- **WHEN** the user enables collection download
- **THEN** the format radio group SHALL be hidden
- **AND** the preset dropdown SHALL remain visible

#### Scenario: Radio group reappears when episodes/collection disabled

- **WHEN** the user disables both episode download and collection download
- **AND** formats have been fetched
- **THEN** the format radio group SHALL reappear

