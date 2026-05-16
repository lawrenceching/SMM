## Purpose

Define IndexedDB persistence, service worker execution, and React hooks for **`process`** background jobs (full VideoCaptioner pipeline).
## Requirements
### Requirement: Process job persistence in IndexedDB

The system SHALL persist full-pipeline **process** jobs as records in the existing **`DownloadTaskDatabase/jobs`** IndexedDB object store using **`type: 'process'`**. Each record SHALL store the originating media folder (platform path), JSON-serialized job data including **platform and POSIX paths** for **`mediaPath`**, flattened **process** options from the dialog, lifecycle status, progress, and `createdAt`/`updatedAt` timestamps, consistent with **`transcribe`**, **`translate`**, and **`synthesize`** records.

#### Scenario: Saving a process job

- **WHEN** the UI calls a dedicated save helper for a **`ProcessBackgroundJob`**
- **THEN** a record with `type === 'process'` is written to the `jobs` store
- **AND** an `indexed-updated` window event is dispatched after the write

#### Scenario: Filtering process jobs by folder

- **WHEN** the UI queries jobs by type and folder for **`process`**
- **THEN** the returned records match the given folder and default age/status filters consistent with other job types unless explicitly documented otherwise

### Requirement: Process job lifecycle in service worker

The system SHALL run process background jobs by calling **`POST /api/executeCmd`** with the process adapter instead of **`POST /api/videocaptioner/process`**.

#### Scenario: Start process job

- **WHEN** the service worker receives `process:start` for a known job
- **THEN** it marks the record as `running`, broadcasts **`process:started`**, and issues executeCmd with process args derived from stored job data
- **AND** on success it marks `succeeded` and broadcasts **`process:succeeded`**
- **AND** on failure it marks `failed` and broadcasts **`process:failed`**

### Requirement: useProcessManager and IndexedDbObserver integration

The system SHALL provide **`useProcessManager`** mirroring **`useSynthesizeManager`** / **`useTranslateManager`** with **`jobType: 'process'`**, appropriate message prefixes, and an **`autoStartKey`** following existing naming conventions. The system SHALL extend **`IndexedDbObserver`** so **`type === 'process'`** records appear in the global background jobs store. **`useJobManager`** SHALL recognize the new job type for user-facing job lists when applicable.

#### Scenario: Path sets reflect running and failed jobs

- **WHEN** **process** jobs exist for media paths
- **THEN** the hook exposes path sets that panels can use to render **`processStatus`** on **`MusicFileTable`** rows consistent with **`music-panel-process-status`**

