## Purpose

Define required UI feedback behavior for transcription actions in `MusicPanel`, including background job lifecycle states and toast notifications.

## Requirements

### Requirement: Transcribe background job lifecycle feedback

The system SHALL create and maintain a transcribe background job lifecycle in the UI when a user confirms **`TranscribeDialog`** from **`MusicPanel`**, including multi-file queue execution semantics.

#### Scenario: Create pending jobs when confirming dialog with multiple rows

- **WHEN** a user confirms **`TranscribeDialog`** opened from **`MusicPanel`** with multiple rows selected
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

- **WHEN** a transcribe job starts after the user confirms **`TranscribeDialog`** with at least one selected row (from **`MusicPanel`**, **TvShowPanel**, or **MoviePanel**)
- **THEN** the UI immediately shows a `Transcribe start` toast before API completion for that job

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

The system SHALL disable the `Transcribe` action in `MusicFileTable` context menu when **both** VideoCaptioner discovery reports unavailable **and** Tencent ASR transcription is not enabled for the application.

#### Scenario: Transcribe is disabled when neither VideoCaptioner nor Tencent path is available

- **WHEN** a user opens `MusicFileTable` context menu while VideoCaptioner discovery state is unavailable **and** Tencent ASR transcription is not enabled for the application
- **THEN** the `Transcribe` menu item is shown as disabled
- **AND** selecting the disabled item does not open **`TranscribeDialog`** or enqueue any transcribe background job

#### Scenario: Transcribe is enabled when VideoCaptioner is available

- **WHEN** a user opens `MusicFileTable` context menu while VideoCaptioner discovery state is available
- **THEN** the `Transcribe` menu item is enabled
- **AND** selecting it opens **`TranscribeDialog`** when the target track has a resolvable **`path`**, consistent with music panel transcribe entry points

#### Scenario: Transcribe is enabled when Tencent ASR is enabled without VideoCaptioner

- **WHEN** a user opens `MusicFileTable` context menu while VideoCaptioner discovery state is unavailable **and** Tencent ASR transcription is enabled for the application
- **THEN** the `Transcribe` menu item is enabled
- **AND** selecting it opens **`TranscribeDialog`** when the target track has a resolvable **`path`**, consistent with music panel transcribe entry points

### Requirement: TranscribeDialog confirmation uses shared background job feedback

The system SHALL apply the same transcribe background job lifecycle and toast feedback used for **`MusicPanel`** when the user confirms **`TranscribeDialog`** opened from **TvShowPanel**, **MoviePanel**, or **MusicPanel**.

#### Scenario: Confirm creates jobs per selected file

- **WHEN** a user confirms **`TranscribeDialog`** with multiple rows selected from TV or movie **`mediaFiles`**, or from **`MusicPanel`** tracks with resolvable paths
- **THEN** the UI creates one transcribe background job per selected file consistent with existing multi-file transcribe semantics
- **AND** start and completion toasts are shown per existing transcribe feedback rules

#### Scenario: Sequential execution preserved

- **WHEN** multiple files are transcribed from **`TranscribeDialog`** (including from **`MusicPanel`**)
- **THEN** transcribe requests for that batch remain non-concurrent as in the existing queue semantics
