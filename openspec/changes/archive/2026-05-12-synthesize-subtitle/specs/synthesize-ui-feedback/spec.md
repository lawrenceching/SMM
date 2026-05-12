## ADDED Requirements

### Requirement: Synthesize background job lifecycle feedback

The system SHALL create and maintain a **`synthesize`** background job lifecycle in the UI when a user confirms **`SynthesizeSubtitleDialog`** from any panel, including multi-job queue execution semantics that mirror **`translate`** (one **`running`** job at a time per batch, remaining jobs **`pending`** until prior jobs reach a terminal state).

#### Scenario: Create pending jobs when confirming dialog with multiple eligible rows

- **WHEN** a user confirms **`SynthesizeSubtitleDialog`** with multiple eligible rows selected
- **THEN** the UI creates one **`synthesize`** background job entry per selected eligible row
- **AND** each created entry starts in `pending` state

#### Scenario: Sequential execution preserved

- **WHEN** multiple **`synthesize`** jobs are confirmed in one batch
- **THEN** **`POST /api/videocaptioner/synthesize`** invocations driven by the service worker for that batch remain non-concurrent

### Requirement: Synthesize toast sequence

The system SHALL surface both start and completion feedback toasts for a **`synthesize`** job (success and failure), using dedicated i18n keys analogous to translate toasts.

#### Scenario: Show start toast immediately

- **WHEN** a **`synthesize`** job starts after the user confirms **`SynthesizeSubtitleDialog`** with at least one selected eligible row
- **THEN** the UI immediately shows a **`Synthesize` start** toast before API completion for that job

#### Scenario: Show completion success toast

- **WHEN** the synthesize API returns a completed success result
- **THEN** the UI shows a success toast indicating synthesis completed

#### Scenario: Show completion failure toast

- **WHEN** the synthesize API returns a completed failure result
- **THEN** the UI shows a failure toast indicating synthesis failed

### Requirement: Synthesize action is disabled when VideoCaptioner is unavailable

The system SHALL disable the **Synthesize** action in panel headers and the **`MusicFileTable`** context menu **Subtitle** submenu when VideoCaptioner discovery reports unavailable, regardless of Tencent ASR availability.

#### Scenario: Synthesize disabled when VideoCaptioner is unavailable

- **WHEN** a user opens the panel header **Subtitle** menu or a row's **Subtitle** submenu while VideoCaptioner discovery state is unavailable
- **THEN** the **Synthesize** menu item is shown as disabled
- **AND** selecting the disabled item does not open **`SynthesizeSubtitleDialog`** or enqueue any **`synthesize`** background job

#### Scenario: Synthesize enabled when VideoCaptioner is available

- **WHEN** VideoCaptioner discovery state is available
- **THEN** the **Synthesize** menu item is enabled if and only if at least one eligible **(video, subtitle)** target exists for that entry point
- **AND** selecting it opens **`SynthesizeSubtitleDialog`** when eligibility rules for that panel are satisfied

### Requirement: SynthesizeSubtitleDialog confirmation uses shared background job feedback

The system SHALL apply the same **`synthesize`** background job lifecycle and toast feedback when **`SynthesizeSubtitleDialog`** is confirmed from **TvShowPanel**, **MoviePanel**, or **MusicPanel**.

#### Scenario: Confirm creates synthesize jobs per selected eligible row

- **WHEN** a user confirms **`SynthesizeSubtitleDialog`** with multiple eligible rows selected
- **THEN** the UI creates one **`synthesize`** background job per selected eligible row
- **AND** start and completion toasts are shown per the synthesize feedback rules
