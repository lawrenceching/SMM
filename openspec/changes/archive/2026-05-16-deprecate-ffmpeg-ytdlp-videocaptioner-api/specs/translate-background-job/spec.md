## MODIFIED Requirements

### Requirement: Translate job lifecycle in service worker

The system SHALL extend the existing service worker (`apps/ui/public/download-service-worker.js`) with translate handlers that accept the messages `translate:start`, `translate:stop`, and `translate:remove`, mirroring the existing `transcribe:*` semantics.

#### Scenario: Start a translate job

- **WHEN** the service worker receives `translate:start` for a known `translate` job
- **THEN** it marks the record as `running` with an updated timestamp and broadcasts `translate:started` to all clients
- **AND** it issues **`POST /api/executeCmd`** with `command: "videocaptioner"` and args from the translate adapter derived from job data (`subtitlePathPlatform`, `translator`, `targetLanguage`, optional `reflect`, `layout`, optional `llm`)
- **AND** when the command completes successfully, it marks the record as `succeeded` (progress = 100) and broadcasts `translate:succeeded`
- **AND** when the command fails or rejects (not due to abort), it marks the record as `failed` and broadcasts `translate:failed`

#### Scenario: Stop a running translate job

- **WHEN** the service worker receives `translate:stop` for a running `translate` job
- **THEN** it aborts the in-flight executeCmd request, marks the record as `stopped`, and broadcasts `translate:stopped`

#### Scenario: Remove a translate job

- **WHEN** the service worker receives `translate:remove` for a `translate` job
- **THEN** it aborts any in-flight executeCmd request, deletes the record, and broadcasts `translate:removed` with `reason: 'user'`
