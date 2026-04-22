## MODIFIED Requirements

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
