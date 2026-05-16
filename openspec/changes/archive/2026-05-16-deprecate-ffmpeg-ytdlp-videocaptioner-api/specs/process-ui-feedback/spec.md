## MODIFIED Requirements

### Requirement: Process background job lifecycle feedback

The system SHALL create and maintain a **`process`** background job lifecycle in the UI when a user confirms **`ProcessPipelineDialog`** from any panel, including multi-job queue execution semantics that mirror **`translate`** / **`synthesize`** (at most one **`running`** job at a time per batch from the service worker for that batch, remaining jobs **`pending`** until prior jobs reach a terminal state).

#### Scenario: Create pending jobs when confirming dialog with multiple eligible rows

- **WHEN** a user confirms **`ProcessPipelineDialog`** with multiple eligible rows selected
- **THEN** the UI creates one **`process`** background job entry per selected eligible row
- **AND** each created entry starts in `pending` state

#### Scenario: Sequential execution preserved

- **WHEN** multiple **`process`** jobs are confirmed in one batch
- **THEN** **`POST /api/executeCmd`** process invocations driven by the service worker for that batch remain non-concurrent
