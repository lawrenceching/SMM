## MODIFIED Requirements

### Requirement: Synthesize job lifecycle in service worker

The system SHALL run synthesize background jobs by calling **`POST /api/executeCmd`** with the synthesize adapter instead of **`POST /api/videocaptioner/synthesize`**.

#### Scenario: Start synthesize job

- **WHEN** the service worker receives `synthesize:start` for a known job
- **THEN** it marks the record as `running`, broadcasts **`synthesize:started`**, and issues executeCmd with synthesize args from stored job data
- **AND** on success it marks `succeeded` and broadcasts **`synthesize:succeeded`**
- **AND** on failure it marks `failed` and broadcasts **`synthesize:failed`**
