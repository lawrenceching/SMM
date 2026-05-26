# video-format-code-selection Specification

## Purpose
TBD - created by archiving change download-video-dialog-support-youtube. Update Purpose after archive.
## Requirements
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

### Requirement: Supplementary format dropdown for audio-only or video-only selections

When the user selects an **audio only** format code, an additional video format code dropdown SHALL appear for selecting a complementary video track.

When the user selects a **video only** format code, an additional audio format code dropdown SHALL appear for selecting a complementary audio track.

When the user selects a combined **audio + video** format code, no supplementary dropdown SHALL appear.

#### Scenario: Audio-only format selected

- **WHEN** the user selects an audio-only format code
- **THEN** a supplementary dropdown labeled "格式码 (视频)" SHALL appear
- **AND** it SHALL list all video-only format codes
- **AND** it SHALL have no default selection

#### Scenario: Video-only format selected

- **WHEN** the user selects a video-only format code
- **THEN** a supplementary dropdown labeled "格式码 (音频)" SHALL appear
- **AND** it SHALL list all audio-only format codes
- **AND** it SHALL have no default selection

#### Scenario: Combined audio+video format selected

- **WHEN** the user selects a combined format code
- **THEN** no supplementary dropdown SHALL appear

#### Scenario: User switches between audio-only and video-only

- **WHEN** the user changes from an audio-only format to a combined format
- **THEN** the supplementary dropdown SHALL disappear
- **WHEN** the user then selects a video-only format
- **THEN** a supplementary audio dropdown SHALL appear

### Requirement: Format code UI is hidden during episodes or collection download

When the user enables episode download or collection download, the format radio group and all format code dropdowns SHALL be hidden. Only the preset dropdown SHALL remain visible.

#### Scenario: Episodes mode hides format codes

- **WHEN** the user checks "下载分集"
- **THEN** the format radio group (预设/格式码) SHALL be hidden
- **AND** any visible format code or supplementary dropdowns SHALL be hidden
- **AND** the preset dropdown SHALL remain visible

#### Scenario: Collection mode hides format codes

- **WHEN** the user checks "下载合集视频"
- **THEN** the format radio group SHALL be hidden
- **AND** the preset dropdown SHALL remain visible

### Requirement: Format code selection produces yt-dlp format ID arguments

When the user starts download in format code mode, the job SHALL store the selected format ID(s) as the yt-dlp `-f` argument. For combined selections (audio + video), the format SHALL be `<video_id>+<audio_id>`.

#### Scenario: Single combined format selected

- **WHEN** the user selects format code "18" (combined audio+video) and starts download
- **THEN** the job's `ytdlpFormat` SHALL be `"18"`

#### Scenario: Audio + video pairing selected

- **WHEN** the user selects audio-only format "140" and supplementary video format "136"
- **THEN** the job's `ytdlpFormat` SHALL be `"136+140"`

