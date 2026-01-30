## ADDED Requirements

### Requirement: Media folder initialization creates background job

When a user imports a media folder via the folder import dialog, the system SHALL create a background job to track the initialization process. The job SHALL be added to the BackgroundJobsProvider and displayed in the BackgroundJobsIndicator.

#### Scenario: Job created on folder import start
- **WHEN** user selects a media folder and confirms import
- **THEN** a new background job is created with status "pending" and progress 0%
- **AND** the BackgroundJobsIndicator shows the new job count

#### Scenario: Job transitions to reading metadata
- **WHEN** the media folder initialization begins reading metadata from the API
- **THEN** the job status updates to "running"
- **AND** job progress updates to 10-40% based on read operation

#### Scenario: Job transitions to preprocessing
- **WHEN** metadata read completes and preprocessing begins
- **THEN** job progress updates to 40-80%
- **AND** the preprocessing signal is connected to the job's abort controller

#### Scenario: Job completes successfully
- **WHEN** all initialization steps complete successfully
- **THEN** job status updates to "succeeded"
- **AND** job progress updates to 100%
- **AND** the media folder appears in the UI with initialized metadata

#### Scenario: Job fails due to error
- **WHEN** an unhandled error occurs during initialization
- **THEN** job status updates to "failed"
- **AND** job progress remains at current value
- **AND** an error message is logged and displayed to the user

### Requirement: Background job can be aborted

The system SHALL allow users to abort a running media folder initialization job via the BackgroundJobsIndicator popover. Aborting SHALL stop all in-progress operations.

#### Scenario: User aborts running job
- **WHEN** user clicks the abort button on a running job in the jobs popover
- **THEN** job status updates to "aborted"
- **AND** all pending async operations are cancelled via abort signal
- **AND** the media folder state is cleaned up

#### Scenario: Job abort prevents UI blocking
- **WHEN** a job is aborted during execution
- **THEN** the UI remains responsive
- **AND** no further progress updates occur for the aborted job

### Requirement: Job progress is visible in status bar

The system SHALL display running and pending background jobs in the BackgroundJobsIndicator component within the status bar.

#### Scenario: Indicator shows active job count
- **WHEN** there is at least one job with status "running" or "pending"
- **THEN** the BackgroundJobsIndicator displays the count of active jobs
- **AND** shows a spinning icon for running jobs or checkmark for pending-only jobs

#### Scenario: Indicator is hidden with no active jobs
- **WHEN** all background jobs have completed (succeeded/failed) or are aborted
- **THEN** the BackgroundJobsIndicator is not rendered
- **AND** the status bar displays only other indicators

#### Scenario: Opening jobs popover
- **WHEN** user clicks the BackgroundJobsIndicator
- **THEN** the jobs popover opens showing job details
- **AND** each job displays name, status badge, and progress bar

### Requirement: Job reflects initialization stages

The system SHALL update job progress and status as the media folder initialization moves through distinct stages.

#### Scenario: Progress updates during metadata read
- **WHEN** the metadata read API call is in progress
- **THEN** job progress incrementally updates from 10% to 40%
- **AND** progress reflects approximate completion of the read operation

#### Scenario: Progress updates during preprocessing
- **WHEN** doPreprocessMediaFolder is executing
- **THEN** job progress incrementally updates from 40% to 80%
- **AND** progress reflects callbacks from the preprocessing function

#### Scenario: Progress reaches completion
- **WHEN** preprocessing completes and final state updates are applied
- **THEN** job progress updates to 95% during finalization
- **AND** job status updates to "succeeded" with 100% progress
