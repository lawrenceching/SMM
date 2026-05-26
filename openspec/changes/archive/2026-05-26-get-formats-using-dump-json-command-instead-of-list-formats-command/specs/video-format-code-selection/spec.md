## MODIFIED Requirements

### Requirement: Dialog shows format code selection alongside presets

After `yt-dlp -J` completes successfully, the DownloadVideoDialog SHALL display a radio group with two options: "预设" (presets) and "格式码" (format codes). Selecting "预设" SHALL show the existing preset dropdown. Selecting "格式码" SHALL show a format code dropdown populated from `VideoMetadata.formats`.

#### Scenario: User selects format code mode

- **WHEN** the user clicks "Go" and format listing succeeds
- **THEN** a radio group with "预设" and "格式码" SHALL appear
- **AND** "预设" SHALL be selected by default
- **WHEN** the user selects "格式码"
- **THEN** the preset dropdown SHALL be replaced by the format code dropdown

#### Scenario: User switches back to preset mode

- **WHEN** the user is in format code mode and selects "预设"
- **THEN** the format code dropdown SHALL be replaced by the preset dropdown
- **AND** the supplementary format dropdown (if visible) SHALL be hidden

### Requirement: Format codes are grouped into three categories

The format code dropdown SHALL group entries from `VideoMetadata.formats` into three categories:
1. **audio only** — formats with `acodec` != "none" and `vcodec` == "none"
2. **video only** — formats with `vcodec` != "none" and `acodec` == "none"
3. **audio + video** — formats with both audio and video codecs (neither labeled "only")

All available formats SHALL be displayed in the dropdown; no additional filtering SHALL be applied.

#### Scenario: YouTube format listing produces all three categories

- **WHEN** `yt-dlp -J` returns formats with audio-only, video-only, and combined entries
- **THEN** the format code dropdown SHALL contain audio-only entries, video-only entries, and combined audio+video entries
- **AND** entries SHALL be visually grouped
