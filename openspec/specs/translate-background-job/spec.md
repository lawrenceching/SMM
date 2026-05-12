## Purpose

Define **translate** background jobs: IndexedDB persistence, service worker messaging, **`useTranslateManager`**, **`IndexedDbObserver`** integration, and auto-start semantics aligned with transcribe.

## Requirements

### Requirement: Translate job persistence in IndexedDB

The system SHALL persist subtitle-translation jobs as records in the existing `DownloadTaskDatabase/jobs` IndexedDB object store using `type: 'translate'`. Each record SHALL store the originating media folder (platform path), the JSON-serialized translate payload, the lifecycle status, and `createdAt`/`updatedAt` timestamps, consistent with the shape used by `download-video` and `transcribe` records.

#### Scenario: Saving a translate job

- **WHEN** the UI calls `saveTranslateJob(job)` for a `TranslateBackgroundJob`
- **THEN** a record with `type === 'translate'` is written to the `jobs` store with the originating folder, serialized data, status, progress, `createdAt`, and `updatedAt`
- **AND** an `indexed-updated` window event is dispatched after the write

#### Scenario: Filtering translate jobs by folder

- **WHEN** the UI calls `getJobsByTypeAndFolder('translate', <folder>)`
- **THEN** the returned records contain only `translate` records that match the given platform folder
- **AND** records with `status === 'succeeded'` are excluded by default
- **AND** records older than one hour are excluded by default

### Requirement: Translate job lifecycle in service worker

The system SHALL extend the existing service worker (`apps/ui/public/download-service-worker.js`) with translate handlers that accept the messages `translate:start`, `translate:stop`, and `translate:remove`, mirroring the existing `transcribe:*` semantics.

#### Scenario: Start a translate job

- **WHEN** the service worker receives `translate:start` for a known `translate` job
- **THEN** it marks the record as `running` with an updated timestamp and broadcasts `translate:started` to all clients
- **AND** it issues `POST /api/videocaptioner/translate` with body fields derived from the job's data (`subtitlePath` set to `subtitlePathPlatform`, `translator`, `targetLanguage`, optional `reflect`, optional `layout`, optional `llm`)
- **AND** when the request resolves successfully, it marks the record as `succeeded` (progress = 100) and broadcasts `translate:succeeded`
- **AND** when the request returns an error or rejects (not due to abort), it marks the record as `failed` and broadcasts `translate:failed`

#### Scenario: Stop a running translate job

- **WHEN** the service worker receives `translate:stop` for a running `translate` job
- **THEN** it aborts the in-flight fetch, marks the record as `stopped`, and broadcasts `translate:stopped`

#### Scenario: Remove a translate job

- **WHEN** the service worker receives `translate:remove` for a `translate` job
- **THEN** it aborts any in-flight fetch, deletes the record, and broadcasts `translate:removed` with `reason: 'user'`

#### Scenario: Stale running translate jobs are recovered on activate

- **WHEN** the service worker activates and finds `translate` records with `status === 'running'`
- **THEN** it rewrites those records to `status === 'stopped'` so the UI can recover or restart them

### Requirement: useTranslateManager hook

The system SHALL expose a `useTranslateManager` hook that wraps the generic `useJobManager` with `jobType: 'translate'` and `messagePrefix: 'translate'`, and surfaces a translate-specific view of the job records.

#### Scenario: Manager exposes path sets

- **WHEN** a consumer uses `useTranslateManager` with a `platformFolder`
- **THEN** the hook returns `translatingPaths: Set<string>`, `pendingTranslatePaths: Set<string>`, `translateFailedPaths: Set<string>`, and `jobIdByPath: Map<string, string>`
- **AND** path keys are POSIX media-file paths derived from each job's `data.mediaPath` when present, otherwise the job's `data.subtitlePath`
- **AND** `translatingPaths` contains paths for records with `status === 'running'`
- **AND** `translateFailedPaths` contains paths for records with `status === 'failed'`
- **AND** `pendingTranslatePaths` contains paths for records with `status === 'pending'`

#### Scenario: Manager exposes job controls

- **WHEN** a consumer uses `useTranslateManager`
- **THEN** the hook returns `startTranslate(jobId)`, `stopTranslate(jobId)`, and `removeTranslate(jobId)` that delegate to the underlying job-manager service-worker messaging

#### Scenario: onJobSucceeded callback fires

- **WHEN** the service worker reports `translate:succeeded` for any record matching the manager's folder
- **THEN** the `onJobSucceeded` callback (if provided) is invoked

### Requirement: IndexedDbObserver maps translate records

The system SHALL extend `IndexedDbObserver` so that `translate` records in the `jobs` store are mapped into the global `BackgroundJob` view alongside `download-video` and `transcribe` records.

#### Scenario: Translate record reflected globally

- **WHEN** a `translate` record exists in the `jobs` store
- **THEN** the global background-jobs view shows a corresponding entry with the job's name, status, and progress
- **AND** subsequent IDB updates and SW `translate:*` messages keep that entry in sync

### Requirement: Auto-start next pending translate job

The system SHALL respect the same auto-start semantics for `translate` jobs as for `transcribe`: when no `translate` job is currently `running`, the manager SHALL transition exactly one `pending` translate job to `running` per panel folder, gated by the `translate.autoStart` localStorage key.

#### Scenario: Sequential start

- **WHEN** at least one `translate` job is `pending`, no `translate` job is `running`, and `translate.autoStart` is not set to `'false'`
- **THEN** the manager posts `translate:start` for exactly one pending job

#### Scenario: AutoStart disabled

- **WHEN** `translate.autoStart` is set to `'false'` in localStorage
- **THEN** the manager does not auto-start `pending` translate jobs; a user-initiated `startTranslate(jobId)` is required to start one
