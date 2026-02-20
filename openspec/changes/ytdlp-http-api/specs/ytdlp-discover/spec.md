## ADDED Requirements

### Requirement: Discover yt-dlp binary path
The system SHALL discover the yt-dlp binary executable path by searching in a specific order.

#### Scenario: yt-dlp found in user config
- **WHEN** user has configured `ytdlpExecutablePath` in user config and the file exists
- **THEN** API returns the configured path

#### Scenario: yt-dlp found in project root
- **WHEN** user config does not have a path, but `bin/yt-dlp/yt-dlp.exe` exists in project root
- **THEN** API returns the project root path

#### Scenario: yt-dlp found in installation path
- **WHEN** user config and project root do not have yt-dlp, but it exists in SMM installation directory
- **THEN** API returns the installation path

#### Scenario: yt-dlp not found
- **WHEN** yt-dlp is not found in any location
- **THEN** API returns HTTP 200 with `{ "error": "yt-dlp not found" }`

### Requirement: Error handling
The system SHALL handle errors gracefully and return appropriate error messages.

#### Scenario: User config read error
- **WHEN** user config file cannot be read
- **THEN** API continues to search other locations (does not fail)
