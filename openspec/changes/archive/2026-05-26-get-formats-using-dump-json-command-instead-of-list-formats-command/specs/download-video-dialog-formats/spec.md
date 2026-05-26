## MODIFIED Requirements

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
