# ytdlp-json-format-listing

Format listing via structured JSON output from `yt-dlp -J` instead of parsing `--list-formats` table output.

## Purpose

Replace the fragile regex-based `--list-formats` table parser with structured JSON parsing via `yt-dlp -J`, using typed interfaces (`VideoMetadata`, `Format`) and a dedicated parse function.

## Requirements

### Requirement: Format listing uses yt-dlp -J command

The system SHALL use `yt-dlp -J <url>` instead of `yt-dlp --list-formats <url>` to fetch per-video format information. The JSON output SHALL be parsed using the `parse()` function from `apps/ui/src/api/ytdlp/parse.ts`, which returns a typed `VideoMetadata` object containing a `formats` array.

#### Scenario: Single video format listing

- **WHEN** the user clicks "Go" for a valid single video URL
- **THEN** the system SHALL execute `yt-dlp -J <url>`
- **AND** parse the stdout into `VideoMetadata` using `parse()`
- **AND** extract the `formats` array from the parsed result

#### Scenario: Playlist URL produces single video metadata

- **WHEN** the user enters a playlist URL for format listing
- **THEN** the system SHALL execute `yt-dlp -J <url>` (which returns a single video, not the full playlist)
- **AND** parse and return the `VideoMetadata` for the first video

### Requirement: Format data is sourced from VideoMetadata.formats

The format code dropdown SHALL be populated from `VideoMetadata.formats`, an array of `Format` objects. Each `Format` SHALL contain the same fields previously parsed from `--list-formats`: `format_id`, `acodec`, `vcodec`, `ext`, `resolution`, `tbr`, `filesize`, `filesize_approx`, `fps`, `width`, `height`.

#### Scenario: Formats array provides all dropdown entries

- **WHEN** `yt-dlp -J` returns a `VideoMetadata` with a `formats` array
- **THEN** the format code dropdown SHALL be populated from every entry in `formats`
- **AND** grouping SHALL use `acodec` and `vcodec` fields from `Format`

### Requirement: listYtdlpFormats API returns VideoMetadata

The `listYtdlpFormats` function in `apps/ui/src/api/ytdlp.ts` SHALL execute `yt-dlp -J` with the same cookie and JS-runtime flags as before, and SHALL return `VideoMetadata` instead of `YtdlpListFormatsResult`.

#### Scenario: listYtdlpFormats returns typed VideoMetadata

- **WHEN** `listYtdlpFormats` is called with a URL and optional cookies/JS-runtime settings
- **THEN** it SHALL parse stdout via `parse()` and return a `VideoMetadata` object
- **AND** the caller SHALL access formats via `result.formats`
