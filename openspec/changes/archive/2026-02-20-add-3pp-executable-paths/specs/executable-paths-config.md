## ADDED Requirements

### Requirement: User can configure yt-dlp executable path
The system SHALL provide an input field in GeneralSettings for users to specify a custom path to the yt-dlp executable. If left empty, the system SHALL use the default yt-dlp from system PATH or bundled binary.

#### Scenario: User enters yt-dlp path manually
- **WHEN** user types a path in the yt-dlp executable path field
- **THEN** the path is stored in user config and can be saved

#### Scenario: User browses for yt-dlp executable
- **WHEN** user clicks the browse button next to yt-dlp path field
- **THEN** a file picker dialog opens allowing selection of an executable file

#### Scenario: User leaves yt-dlp path empty
- **WHEN** user saves settings with empty yt-dlp path field
- **THEN** the config stores undefined/empty value indicating default behavior

### Requirement: User can configure ffmpeg executable path
The system SHALL provide an input field in GeneralSettings for users to specify a custom path to the ffmpeg executable. If left empty, the system SHALL use the default ffmpeg from system PATH or bundled binary.

#### Scenario: User enters ffmpeg path manually
- **WHEN** user types a path in the ffmpeg executable path field
- **THEN** the path is stored in user config and can be saved

#### Scenario: User browses for ffmpeg executable
- **WHEN** user clicks the browse button next to ffmpeg path field
- **THEN** a file picker dialog opens allowing selection of an executable file

#### Scenario: User leaves ffmpeg path empty
- **WHEN** user saves settings with empty ffmpeg path field
- **THEN** the config stores undefined/empty value indicating default behavior

### Requirement: Executable paths are persisted with other settings
The ytdlpExecutablePath and ffmpegExecutablePath values SHALL be saved to smm.json along with other user config when the user clicks the save button.

#### Scenario: Save button appears when executable paths change
- **WHEN** user modifies either executable path field
- **THEN** the save button appears in the bottom-right corner

#### Scenario: Executable paths persist after app restart
- **WHEN** user saves executable paths and restarts the application
- **THEN** the saved paths are loaded and displayed in the input fields
