## Purpose
Define required UI feedback behavior for transcription actions in `MusicPanel`, including background job lifecycle states and toast notifications.
## Requirements
### Requirement: Transcribe background job lifecycle feedback
The system SHALL create and maintain a transcribe background job lifecycle in the UI when a user triggers transcription from `MusicPanel`.

#### Scenario: Create running job on transcribe click
- **WHEN** a user clicks `Transcribe` for a media file in `MusicPanel`
- **THEN** the UI creates a background job entry with running state before awaiting API completion

#### Scenario: Mark job succeeded on completed success
- **WHEN** the transcribe API returns a completed success result
- **THEN** the matching background job is updated to succeeded state

#### Scenario: Mark job failed on completed error
- **WHEN** the transcribe API returns a completed failure result or request error
- **THEN** the matching background job is updated to failed state

### Requirement: Transcribe toast sequence
The system SHALL surface both start and completion feedback toasts for a transcribe request.

#### Scenario: Show start toast immediately
- **WHEN** a user clicks `Transcribe`
- **THEN** the UI immediately shows a `Transcribe start` toast before API completion

#### Scenario: Show completion success toast
- **WHEN** the API returns a completed success result
- **THEN** the UI shows a success toast indicating transcription completed

#### Scenario: Show completion failure toast
- **WHEN** the API returns a completed failure result
- **THEN** the UI shows a failure toast indicating transcription failed

### Requirement: Music panel supports explicit multi-select mode in file table interactions
The system SHALL allow `MusicPanel` to orchestrate an explicit multi-select mode for `MusicFileTable` interactions, with mode transitions initiated by `MusicHeaderV2`.

#### Scenario: Header and table mode states stay synchronized
- **WHEN** a user toggles `Select` or `Cancel` from `MusicHeaderV2`
- **THEN** `MusicPanel` updates mode state and `MusicFileTable` reflects the matching selection-mode rendering state

