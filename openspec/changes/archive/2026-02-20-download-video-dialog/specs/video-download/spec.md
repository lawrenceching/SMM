## ADDED Requirements

### Requirement: User can download video from URL
The system SHALL allow users to download videos from any supported URL using yt-dlp.

#### Scenario: User downloads video with valid URL
- **WHEN** user enters a valid video URL, selects a download folder, and clicks Start
- **THEN** system downloads the video to the specified folder and shows success message

#### Scenario: User provides invalid URL
- **WHEN** user enters an invalid URL and clicks Start
- **THEN** system shows an error message indicating the URL is invalid

#### Scenario: yt-dlp not found
- **WHEN** user attempts to download but yt-dlp executable is not found
- **THEN** system shows an error message indicating yt-dlp was not found

### Requirement: User can select download folder
The system SHALL allow users to select a download folder using the file picker dialog.

#### Scenario: User selects download folder
- **WHEN** user clicks the folder icon button
- **THEN** system opens the file picker dialog in folder selection mode

#### Scenario: User confirms folder selection
- **WHEN** user selects a folder and confirms in the file picker
- **THEN** system populates the download folder field with the selected path
