## ADDED Requirements

### Requirement: Transcribe action is disabled when VideoCaptioner is unavailable
The system SHALL disable the `Transcribe` action in `MusicFileTable` context menu when VideoCaptioner discovery reports unavailable.

#### Scenario: Transcribe is disabled when executable is missing
- **WHEN** a user opens `MusicFileTable` context menu while VideoCaptioner discovery state is unavailable
- **THEN** the `Transcribe` menu item is shown as disabled
- **AND** selecting the disabled item does not enqueue or start any transcribe background job

#### Scenario: Transcribe is enabled when executable is available
- **WHEN** a user opens `MusicFileTable` context menu while VideoCaptioner discovery state is available
- **THEN** the `Transcribe` menu item is enabled
- **AND** selecting it can start the existing transcribe workflow
