## ADDED Requirements

### Requirement: Process background job lifecycle feedback

The system SHALL create and maintain a **`process`** background job lifecycle in the UI when a user confirms **`ProcessPipelineDialog`** from any panel, including multi-job queue execution semantics that mirror **`translate`** / **`synthesize`** (at most one **`running`** job at a time per batch from the service worker for that batch, remaining jobs **`pending`** until prior jobs reach a terminal state).

#### Scenario: Create pending jobs when confirming dialog with multiple eligible rows

- **WHEN** a user confirms **`ProcessPipelineDialog`** with multiple eligible rows selected
- **THEN** the UI creates one **`process`** background job entry per selected eligible row
- **AND** each created entry starts in `pending` state

#### Scenario: Sequential execution preserved

- **WHEN** multiple **`process`** jobs are confirmed in one batch
- **THEN** **`POST /api/videocaptioner/process`** invocations driven by the service worker for that batch remain non-concurrent

### Requirement: Process toast sequence

The system SHALL surface both start and completion feedback toasts for a **`process`** job (success and failure), using dedicated i18n keys analogous to transcribe/translate/synthesize toasts.

#### Scenario: Show start toast immediately

- **WHEN** a **`process`** job starts after the user confirms **`ProcessPipelineDialog`** with at least one selected eligible row
- **THEN** the UI immediately shows a **process start** toast before API completion for that job

#### Scenario: Show completion success toast

- **WHEN** the **process** API returns a completed success result
- **THEN** the UI shows a success toast indicating the pipeline completed

#### Scenario: Show completion failure toast

- **WHEN** the **process** API returns a completed failure result
- **THEN** the UI shows a failure toast indicating the pipeline failed

### Requirement: Process action is disabled when VideoCaptioner is unavailable

The system SHALL disable the **Process** action in panel headers and the **`MusicFileTable`** context menu **Subtitle** submenu when VideoCaptioner discovery reports unavailable, regardless of Tencent ASR availability.

#### Scenario: Process disabled when VideoCaptioner is unavailable

- **WHEN** a user opens the panel header **Subtitle** menu or a row's **Subtitle** submenu while VideoCaptioner discovery state is unavailable
- **THEN** the **Process** menu item is shown as disabled
- **AND** selecting the disabled item does not open **`ProcessPipelineDialog`** or enqueue any **`process`** background job

#### Scenario: Process enabled when VideoCaptioner is available

- **WHEN** VideoCaptioner discovery state is available
- **THEN** the **Process** menu item is enabled if and only if at least one eligible media target exists for that entry point and ASR/configuration gating for the default or selected options is satisfied
- **AND** selecting it opens **`ProcessPipelineDialog`** when eligibility rules for that panel are satisfied

### Requirement: ProcessPipelineDialog confirmation uses shared background job feedback

The system SHALL apply the same **`process`** background job lifecycle and toast feedback when **`ProcessPipelineDialog`** is confirmed from **TvShowPanel**, **MoviePanel**, or **MusicPanel**.

#### Scenario: Confirm creates process jobs per selected eligible row

- **WHEN** a user confirms **`ProcessPipelineDialog`** with multiple eligible rows selected
- **THEN** the UI creates one **`process`** background job per selected eligible row
- **AND** start and completion toasts are shown per the **process** feedback rules
