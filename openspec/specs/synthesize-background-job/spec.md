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

The system SHALL run synthesize background jobs by calling **`POST /api/executeCmd`** with the synthesize adapter instead of **`POST /api/videocaptioner/synthesize`**.

#### Scenario: Start synthesize job

- **WHEN** the service worker receives `synthesize:start` for a known job
- **THEN** it marks the record as `running`, broadcasts **`synthesize:started`**, and issues executeCmd with synthesize args from stored job data
- **AND** on success it marks `succeeded` and broadcasts **`synthesize:succeeded`**
- **AND** on failure it marks `failed` and broadcasts **`synthesize:failed`**

### Requirement: useSynthesizeManager and IndexedDbObserver integration

The system SHALL provide **`useSynthesizeManager`** mirroring **`useTranslateManager`** with **`jobType: 'synthesize'`**, appropriate message prefixes, and an **`autoStartKey`** following existing naming conventions. The system SHALL extend **`IndexedDbObserver`** so **`type === 'synthesize'`** records appear in the global background jobs store. **`useJobManager`** (or equivalent) SHALL recognize the new job type for user-facing job lists when applicable.

#### Scenario: Path sets reflect running and failed jobs

- **WHEN** synthesize jobs exist for media paths
- **THEN** the hook exposes path sets that panels can use to render **`synthesizeStatus`** on **`MusicFileTable`** rows consistent with **`music-panel-synthesize-status`**

