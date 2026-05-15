## ADDED Requirements

### Requirement: App-level provider owns all background job coordination
The system SHALL mount a `JobOrchestratorProvider` React component at the app root (above all panels, dialogs, and routing). It SHALL remain mounted for the entire app lifetime and SHALL be the single owner of:
- IndexedDB ↔ Zustand synchronization
- Service Worker registration and message routing
- Auto-start queue (one running job per `(type, folder)` pair)
- Startup reconciliation (marking stale running jobs as stopped/aborted on app boot)

The provider SHALL NOT import any job factory, any per-type hook, or any job-type-specific types. All type-specific behavior SHALL be driven by `JOB_TYPE_REGISTRY`.

#### Scenario: Provider survives panel navigation
- **WHEN** the user navigates away from MusicPanel (unmounting it)
- **THEN** the orchestrator continues processing SW messages and auto-starting pending jobs

#### Scenario: Startup reconciliation on mount
- **WHEN** the orchestrator mounts and the SW becomes ready
- **THEN** any jobs with status `'running'` in IndexedDB are marked as `'stopped'` or `'aborted'` (they were running in a previous session and the SW no longer has them active)

#### Scenario: Auto-start on sync
- **WHEN** a new pending job appears in IndexedDB (via `createJob` or `indexed-updated` event)
- **THEN** the orchestrator attempts to auto-start it if: (a) the SW is ready, (b) the type's `autoStartKey` preference is not `'false'`, and (c) no other job of the same `(type, folder)` is currently running

---

### Requirement: Imperative API via React context
The orchestrator SHALL expose the following imperative methods through React context, accessible via `useJobOrchestrator()`:

- **`createJob(job: BackgroundJob): Promise<string>`** — persists a pre-built job to IndexedDB, syncs to Zustand, triggers auto-start for its `(type, folder)`, and returns the job's ID
- **`createJobs(jobs: BackgroundJob[]): Promise<{ successIds: string[], failures: Array<{ job: BackgroundJob, error: string }> }>`** — non-transactional batch write; partial failure is allowed; each failure includes the original job and error message
- **`startJob(id: string, options?: { forceStart?: boolean }): Promise<StartJobResult>`** — starts a specific job. Without `forceStart`, respects the concurrency guard and returns `{ started: false, reason: 'concurrency-blocked' }` if another job of the same `(type, folder)` is running. With `forceStart: true`, bypasses the concurrency guard and the auto-start preference toggle
- **`stopJob(id: string): void`** — sends a stop message to the SW for the job
- **`removeJob(id: string): Promise<void>`** — deletes the job from IndexedDB and the Zustand store

#### Scenario: `createJob` triggers auto-start
- **WHEN** `createJob(job)` is called with a valid `BackgroundJob`
- **THEN** the job is written to IndexedDB, the Zustand store is updated, and if auto-start conditions are met the job starts within the same event loop cycle (or as soon as the SW is ready)

#### Scenario: `createJobs` partial failure
- **WHEN** `createJobs([jobA, jobB])` is called and `jobB`'s write to IndexedDB fails
- **THEN** `jobA` is persisted normally, and the return value is `{ successIds: [jobA.id], failures: [{ job: jobB, error: '...' }] }`

#### Scenario: `startJob` without `forceStart` respects concurrency
- **WHEN** `startJob(id)` is called and another job of the same `(type, folder)` is already running
- **THEN** it returns `{ started: false, reason: 'concurrency-blocked' }` and the job remains pending in the auto-start queue

#### Scenario: `startJob` with `forceStart` bypasses concurrency
- **WHEN** `startJob(id, { forceStart: true })` is called even if a running job exists for the same `(type, folder)`
- **THEN** the job is dispatched to the SW immediately regardless of other running jobs or the auto-start preference setting

#### Scenario: `startJob` with unknown ID
- **WHEN** `startJob('nonexistent-id')` is called
- **THEN** it returns `{ started: false, reason: 'job-not-found' }`

#### Scenario: `startJob` before SW is ready
- **WHEN** `startJob(id)` is called before the Service Worker is registered and ready
- **THEN** it returns `{ started: false, reason: 'sw-not-ready' }`

---

### Requirement: Reactive `useFileStatuses` hook
The orchestrator context SHALL expose a `useFileStatuses(folder: string, type: string)` hook that reactively returns the file-level job status for a given folder and job type.

The return value SHALL include:
- `runningPaths: Set<string>` — paths with at least one running job
- `pendingPaths: Set<string>` — paths with at least one pending job
- `failedPaths: Set<string>` — paths with at least one failed job
- `jobIdsByPath: Map<string, string[]>` — all job IDs per path, sorted by creation time ascending
- `primaryJobIdByPath: Map<string, string>` — the highest-priority active job per path (running > pending > failed > other)

#### Scenario: Running path reflected immediately
- **WHEN** a job transitions to `'running'` status via a SW message
- **THEN** `runningPaths` for the corresponding `(folder, type)` is updated in the next React render

#### Scenario: Multiple jobs for same path
- **WHEN** two jobs of the same type exist for the same `(folder, path)` — one pending, one failed
- **THEN** `jobIdsByPath` contains both IDs, and `primaryJobIdByPath` returns the pending job's ID (pending > failed priority)

#### Scenario: Path excluded when `extractPath` returns empty
- **WHEN** a job's `extractPath` returns `''`
- **THEN** that job does not appear in any `useFileStatuses` result set

---

### Requirement: Reactive `useJobIndicatorState` hook
The orchestrator context SHALL expose a `useJobIndicatorState()` hook that returns aggregated counts and state for the StatusBar indicator:
- `runningCount: number`, `pendingCount: number`, `failedCount: number`
- `statusVariant: 'running' | 'warning' | 'success'`
- `isPopoverOpen: boolean` and `setPopoverOpen: (open: boolean) => void`

#### Scenario: Variant reflects highest-priority state
- **WHEN** there is at least one running job
- **THEN** `statusVariant` is `'running'`

#### Scenario: Warning when no running jobs but failures exist
- **WHEN** there are no running jobs and at least one failed job
- **THEN** `statusVariant` is `'warning'`

---

### Requirement: Generic SW message handler
The orchestrator SHALL register a single `navigator.serviceWorker` message listener that handles events for all registered job types without any per-type conditional branches. Type identification SHALL use `JOB_TYPE_REGISTRY` to match the event string to a type.

#### Scenario: `succeeded` event triggers next auto-start
- **WHEN** the SW posts `{ event: 'transcribe:succeeded', id: 'job-123' }`
- **THEN** the orchestrator re-syncs IndexedDB to Zustand and calls `tryAutoStart('transcribe', job.folder)` to start the next pending transcribe job for that folder

#### Scenario: Heartbeat events are ignored
- **WHEN** the SW posts an event ending in `:heartbeat`
- **THEN** the orchestrator takes no action (no re-sync, no state update)

#### Scenario: Unknown event type is ignored
- **WHEN** the SW posts `{ event: 'unknown-type:started', id: 'job-456' }`
- **THEN** the orchestrator ignores the message without error

---

### Requirement: Non-React consumers via `window.__jobOrchestrator`
The orchestrator SHALL assign `window.__jobOrchestrator` on mount with the following interface: `{ createJob, createJobs, startJob, stopJob, removeJob, isReady: () => boolean }`. It SHALL clear this assignment on unmount.

#### Scenario: MCP tool creates a job
- **WHEN** `window.__jobOrchestrator.createJob(job)` is called from non-React code (e.g., MCP tool)
- **THEN** the job is persisted and auto-started by the same orchestrator logic as React callers

#### Scenario: `isReady` reflects SW state
- **WHEN** `window.__jobOrchestrator.isReady()` is called before the SW is ready
- **THEN** it returns `false`; once the SW registers successfully it returns `true`

---

### Requirement: Concurrency model — one running job per `(type, folder)`
The orchestrator SHALL enforce a maximum of one running job per `(type, folder)` pair. Different types MAY run concurrently in the same folder. Different folders are fully independent.

#### Scenario: Second job of same type in same folder is queued
- **WHEN** a download job for folder `C:/Music` is running and a second download job for `C:/Music` is created
- **THEN** the second job remains `pending` until the first completes, at which point it is auto-started

#### Scenario: Different types run in parallel
- **WHEN** a transcribe job and a download job both exist for folder `C:/Music` and both are pending
- **THEN** both may start concurrently (they are different types)
