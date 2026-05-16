## MODIFIED Requirements

### Requirement: Process job lifecycle in service worker

The system SHALL run process background jobs by calling **`POST /api/executeCmd`** with the process adapter instead of **`POST /api/videocaptioner/process`**.

#### Scenario: Start process job

- **WHEN** the service worker receives `process:start` for a known job
- **THEN** it marks the record as `running`, broadcasts **`process:started`**, and issues executeCmd with process args derived from stored job data
- **AND** on success it marks `succeeded` and broadcasts **`process:succeeded`**
- **AND** on failure it marks `failed` and broadcasts **`process:failed`**
