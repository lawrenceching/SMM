## ADDED Requirements

### Requirement: Synchronous whitelisted commands expose execution correlation

The system SHALL extend the structured result of `runWhitelistedCommandSync` so that every completed or failed invocation includes `executionId` and `logRelativePath` when a command execution log writer was created for that run.

#### Scenario: Success response includes correlation

- **WHEN** `runWhitelistedCommandSync` finishes with exit code `0`
- **THEN** the returned object includes `success: true` together with `executionId` and `logRelativePath` matching the writer used for that process

#### Scenario: Failure response still includes correlation when log exists

- **WHEN** `runWhitelistedCommandSync` finishes with a non-zero exit code or spawn error after the log writer was created
- **THEN** the returned object includes `error` together with `executionId` and `logRelativePath` when available

### Requirement: Videocaptioner JSON routes echo correlation fields

The system SHALL include `executionId` and `logRelativePath` in JSON responses for `POST /api/videocaptioner/transcribe`, `translate`, `synthesize`, and `process` whenever those routes delegate to `runWhitelistedCommandSync`, for both HTTP 200 and HTTP 400 outcomes that still produced a log writer.

#### Scenario: Error JSON still carries ids

- **WHEN** the route returns `400` with `{ "error": "..." }` after a logged invocation
- **THEN** the JSON body also contains `executionId` and `logRelativePath` fields when the underlying synchronous runner populated them

### Requirement: Service worker persists correlation on subtitle jobs

The system SHALL update `apps/ui/public/download-service-worker.js` handlers for `transcribe`, `translate`, `synthesize`, and `process` jobs so that after receiving the videocaptioner JSON response, the job’s serialized `data` includes `executionId` and optional `logRelativePath` before the job transitions to a terminal status, and the record is written with `dbPutJob`.

#### Scenario: Successful videocaptioner call stores ids

- **WHEN** the service worker completes `POST /api/videocaptioner/<op>` with HTTP 200 and a JSON body containing `executionId`
- **THEN** the corresponding IndexedDB job record’s `data` field contains that `executionId` (and `logRelativePath` when provided) prior to marking the job `succeeded`

#### Scenario: Failed videocaptioner call still stores ids when returned

- **WHEN** the service worker receives HTTP 400 with JSON containing `executionId`
- **THEN** the job record’s `data` field is updated with those correlation fields before marking the job `failed`

### Requirement: IndexedDbObserver maps correlation into BackgroundJob

The system SHALL extend `IndexedDbObserver` deserialization for `transcribe`, `translate`, `synthesize`, and `process` types so optional `executionId` and `logRelativePath` fields in the persisted JSON `data` are copied onto the typed `BackgroundJob` objects consumed by `backgroundJobsStore`.

#### Scenario: Store receives correlation fields

- **WHEN** a persisted job record includes `executionId` in its JSON `data`
- **THEN** the mapped `BackgroundJob` exposed through `backgroundJobsStore` exposes the same values on the job’s typed `data` object for UI consumers
