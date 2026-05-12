## Purpose

Define persistence, service worker execution, and React hooks for **`synthesize`** background jobs (IndexedDB, SW messages, observers).

## Requirements

### Requirement: Synthesize job persistence in IndexedDB

The system SHALL persist subtitle-to-video synthesis jobs as records in the existing **`DownloadTaskDatabase/jobs`** IndexedDB object store using **`type: 'synthesize'`**. Each record SHALL store the originating media folder (platform path), JSON-serialized job data including **platform and POSIX paths** for video and subtitle, selected synthesis options, lifecycle status, progress, and `createdAt`/`updatedAt` timestamps, consistent with **`transcribe`** and **`translate`** records.

#### Scenario: Saving a synthesize job

- **WHEN** the UI calls a dedicated save helper for a **`SynthesizeBackgroundJob`**
- **THEN** a record with `type === 'synthesize'` is written to the `jobs` store
- **AND** an `indexed-updated` window event is dispatched after the write

#### Scenario: Filtering synthesize jobs by folder

- **WHEN** the UI queries jobs by type and folder for **`synthesize`**
- **THEN** the returned records match the given folder and default age/status filters consistent with other job types unless explicitly documented otherwise

### Requirement: Synthesize job lifecycle in service worker

The system SHALL extend **`apps/ui/public/download-service-worker.js`** with synthesize handlers that accept **`synthesize:start`**, **`synthesize:stop`**, and **`synthesize:remove`**, mirroring **`translate:*`** semantics including heartbeat naming consistent with the chosen event prefix for this job type.

#### Scenario: Start a synthesize job

- **WHEN** the service worker receives **`synthesize:start`** for a known **`synthesize`** job
- **THEN** it marks the record as `running`, broadcasts **`synthesize:started`**, and issues **`POST /api/videocaptioner/synthesize`** with a body derived from stored job data
- **AND** on success it marks the record `succeeded` and broadcasts **`synthesize:succeeded`**
- **AND** on failure it marks `failed` and broadcasts **`synthesize:failed`**
- **AND** on stop it marks `stopped` and broadcasts **`synthesize:stopped`**

#### Scenario: Stale running synthesize jobs on SW activate

- **WHEN** the service worker activates and finds `running` **`synthesize`** records from a prior session
- **THEN** those records are transitioned to `stopped` (or equivalent safe terminal state) consistent with **`translate`** reactivation behavior

### Requirement: useSynthesizeManager and IndexedDbObserver integration

The system SHALL provide **`useSynthesizeManager`** mirroring **`useTranslateManager`** with **`jobType: 'synthesize'`**, appropriate message prefixes, and an **`autoStartKey`** following existing naming conventions. The system SHALL extend **`IndexedDbObserver`** so **`type === 'synthesize'`** records appear in the global background jobs store. **`useJobManager`** (or equivalent) SHALL recognize the new job type for user-facing job lists when applicable.

#### Scenario: Path sets reflect running and failed jobs

- **WHEN** synthesize jobs exist for media paths
- **THEN** the hook exposes path sets that panels can use to render **`synthesizeStatus`** on **`MusicFileTable`** rows consistent with **`music-panel-synthesize-status`**
