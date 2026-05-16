## MODIFIED Requirements

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
