# subtitle-job-command-log-correlation

End-to-end correlation of CLI command execution logs with subtitle pipeline background jobs and synchronous videocaptioner routes.
## Requirements
### Requirement: Synchronous whitelisted commands expose execution correlation

The system SHALL extend the structured result of `runWhitelistedCommandSync` so that every completed or failed invocation includes `executionId` and `logRelativePath` when a command execution log writer was created for that run.

#### Scenario: Success response includes correlation

- **WHEN** `runWhitelistedCommandSync` finishes with exit code `0`
- **THEN** the returned object includes `success: true` together with `executionId` and `logRelativePath` matching the writer used for that process

#### Scenario: Failure response still includes correlation when log exists

- **WHEN** `runWhitelistedCommandSync` finishes with a non-zero exit code or spawn error after the log writer was created
- **THEN** the returned object includes `error` together with `executionId` and `logRelativePath` when available

### Requirement: Videocaptioner JSON routes echo correlation fields

The system SHALL obtain **`executionId`** and **`logRelativePath`** from **`POST /api/executeCmd`** response headers (`X-Command-Execution-Id`, `X-Command-Log-Path`) when the Service Worker or UI runs VideoCaptioner via executeCmd. Dedicated `POST /api/videocaptioner/*` JSON routes SHALL NOT be used.

#### Scenario: Error JSON still carries ids

- **WHEN** executeCmd completes with correlation headers after a logged invocation
- **THEN** the client SHALL persist `executionId` and `logRelativePath` from those headers

### Requirement: Service worker persists correlation on subtitle jobs

The system SHALL update `apps/ui/public/download-service-worker.js` handlers for `transcribe`, `translate`, `synthesize`, and `process` jobs so that after completing executeCmd, the job's serialized `data` includes `executionId` and optional `logRelativePath` before the job transitions to a terminal status, and the record is written with `dbPutJob`.

#### Scenario: Successful videocaptioner executeCmd stores ids

- **WHEN** the service worker completes a VideoCaptioner executeCmd invocation with correlation headers present
- **THEN** the corresponding IndexedDB job record's `data` field contains that `executionId` (and `logRelativePath` when provided) prior to marking the job `succeeded`

#### Scenario: Failed videocaptioner executeCmd still stores ids when returned

- **WHEN** executeCmd fails but response headers included `executionId`
- **THEN** the job record's `data` field is updated with those correlation fields before marking the job `failed`

### Requirement: IndexedDbObserver maps correlation into BackgroundJob

The system SHALL extend `IndexedDbObserver` deserialization for `transcribe`, `translate`, `synthesize`, and `process` types so optional `executionId` and `logRelativePath` fields in the persisted JSON `data` are copied onto the typed `BackgroundJob` objects consumed by `backgroundJobsStore`.

#### Scenario: Store receives correlation fields

- **WHEN** a persisted job record includes `executionId` in its JSON `data`
- **THEN** the mapped `BackgroundJob` exposed through `backgroundJobsStore` exposes the same values on the job’s typed `data` object for UI consumers

