## MODIFIED Requirements

### Requirement: Synthesize background job lifecycle feedback

The system SHALL create and maintain a **`synthesize`** background job lifecycle in the UI when a user confirms **`SynthesizeSubtitleDialog`** from any panel, including multi-job queue execution semantics that mirror **`translate`** (one **`running`** job at a time per batch, remaining jobs **`pending`** until prior jobs reach a terminal state).

#### Scenario: Create pending jobs when confirming dialog with multiple eligible rows

- **WHEN** a user confirms **`SynthesizeSubtitleDialog`** with multiple eligible rows selected
- **THEN** the UI creates one **`synthesize`** background job entry per selected eligible row
- **AND** each created entry starts in `pending` state

#### Scenario: Sequential execution preserved

- **WHEN** multiple **`synthesize`** jobs are confirmed in one batch
- **THEN** **`POST /api/executeCmd`** synthesize invocations driven by the service worker for that batch remain non-concurrent
