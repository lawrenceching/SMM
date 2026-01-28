## ADDED Requirements

### Requirement: Display background job status indicator in StatusBar
The StatusBar component SHALL display a background job indicator icon when at least one background job is running. The indicator SHALL be hidden when no jobs are running.

#### Scenario: Indicator shows when jobs are running
- **WHEN** one or more background jobs are in running state
- **THEN** StatusBar displays the background job icon
- **AND** the icon is visible in the right side of the status bar

#### Scenario: Indicator hides when no jobs are running
- **WHEN** no background jobs exist or all jobs are completed/failed
- **THEN** StatusBar hides the background job icon
- **AND** the status bar layout adjusts accordingly

### Requirement: Display background jobs in popover
Clicking the background job indicator SHALL open a popover displaying a list of all background jobs.

#### Scenario: Open popover on indicator click
- **WHEN** user clicks the background job indicator
- **THEN** popover displays showing list of all background jobs
- **AND** popover is positioned near the indicator

#### Scenario: Close popover on outside click
- **WHEN** user clicks outside the popover or indicator
- **THEN** popover closes and background jobs list is hidden

### Requirement: Display job status and progress
Each background job in the list SHALL display its name, status (pending, running, failed, succeeded), and progress.

#### Scenario: Display job information
- **WHEN** popover is open with jobs in list
- **THEN** each job item shows: job name, status icon/badge, and progress indicator
- **AND** status is visually distinguished by color or icon

#### Scenario: Show progress for running jobs
- **WHEN** a job is in running state
- **THEN** job item displays progress bar or percentage
- **AND** progress updates reflect the job's current progress value

### Requirement: Abort running background job
Each running job SHALL have a stop button that allows users to abort the job.

#### Scenario: Stop button on running jobs
- **WHEN** popover displays a running job
- **THEN** job item includes a stop button
- **AND** button is disabled or hidden for non-running jobs

#### Scenario: User aborts a job
- **WHEN** user clicks the stop button on a running job
- **THEN** job status changes to aborted
- **AND** stop button is disabled or removed from that job item

### Requirement: Mock background job system
The system SHALL provide a mock background job implementation for demonstration purposes, including at least one "Scanning Media Library" job.

#### Scenario: Create mock scanning job
- **WHEN** application initializes or user triggers mock job
- **THEN** system creates a "Scanning Media Library" job with running status
- **AND** job progress updates over time to simulate scanning operation

#### Scenario: Mock job completes
- **WHEN** mock job progress reaches 100%
- **THEN** job status changes to succeeded
- **AND** job remains in list for viewing historical status

### Requirement: Background job data structure
Background jobs SHALL have the following properties: name (string), status (pending | running | failed | succeeded | aborted), progress (number 0-100), and id (unique identifier).

#### Scenario: Job properties defined
- **WHEN** a background job is created
- **THEN** job object contains: id (string), name (string), status (enum), progress (number 0-100)
- **AND** status MUST be one of: pending, running, failed, succeeded, aborted

#### Scenario: Job uniqueness
- **WHEN** multiple jobs exist
- **THEN** each job has a unique id
- **AND** jobs can be identified and referenced by their id
