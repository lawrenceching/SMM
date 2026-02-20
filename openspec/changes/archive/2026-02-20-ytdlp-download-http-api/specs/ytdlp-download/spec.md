## ADDED Requirements

### Requirement: Download video with yt-dlp
The system SHALL accept a video URL and optional arguments to download using yt-dlp.

#### Scenario: Download with valid URL and no args
- **WHEN** POST request with valid `url` and no `args` is received
- **THEN** yt-dlp downloads the video to `~/Downloads` (default) and returns success response with the downloaded file path

#### Scenario: Download with valid URL and --write-thumbnail
- **WHEN** POST request with valid `url` and args containing `--write-thumbnail` is received
- **THEN** yt-dlp downloads the video with thumbnail and returns success response

#### Scenario: Download with valid URL and --embed-thumbnail
- **WHEN** POST request with valid `url` and args containing `--embed-thumbnail` is received
- **THEN** yt-dlp downloads the video with embedded thumbnail and returns success response

#### Scenario: Download with custom folder
- **WHEN** POST request with valid `url` and `folder` parameter is received
- **THEN** yt-dlp downloads the video to the specified folder and returns success response with the downloaded file path

#### Scenario: Download with invalid URL
- **WHEN** POST request with invalid or missing `url` is received
- **THEN** API returns HTTP 400 with error message "url is required"

#### Scenario: Download with disallowed args
- **WHEN** POST request with args other than `--write-thumbnail` or `--embed-thumbnail` is received
- **THEN** API returns HTTP 400 with error message listing allowed args

#### Scenario: yt-dlp executable not found
- **WHEN** yt-dlp executable cannot be discovered
- **THEN** API returns HTTP 400 with error "yt-dlp executable not found"

#### Scenario: yt-dlp download fails
- **WHEN** yt-dlp command fails during download
- **THEN** API returns HTTP 400 with error message from yt-dlp
