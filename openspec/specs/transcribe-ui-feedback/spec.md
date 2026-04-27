## Purpose
Define required UI feedback behavior for transcription actions in `MusicPanel`, including background job lifecycle states and toast notifications.
## Requirements
### Requirement: Transcribe background job lifecycle feedback
The system SHALL create and maintain a transcribe background job lifecycle in the UI when a user triggers transcription from `MusicPanel`, including multi-file queue execution semantics.

#### Scenario: Create pending jobs for batch transcribe
- **WHEN** a user in select mode clicks `Transcribe` with multiple media files selected in `MusicPanel`
- **THEN** the UI creates one background job entry per selected file
- **AND** each created entry starts in `pending` state

#### Scenario: Start only one pending job at a time
- **WHEN** there is at least one `pending` transcribe job and no `running` transcribe job in the current batch
- **THEN** the UI transitions exactly one pending job to `running`
- **AND** all other jobs in the batch remain `pending`

#### Scenario: Mark job succeeded on completed success
- **WHEN** the transcribe API returns a completed success result for the running job
- **THEN** the matching background job is updated to `succeeded` state

#### Scenario: Mark job failed on completed error
- **WHEN** the transcribe API returns a completed failure result or request error for the running job
- **THEN** the matching background job is updated to `failed` state

#### Scenario: Continue with next pending job after terminal result
- **WHEN** the current running job transitions to `succeeded` or `failed` and another job in the same batch is still `pending`
- **THEN** the UI starts the next pending job
- **AND** transcription requests for jobs in the batch remain non-concurrent

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

