# Background Jobs — v2 Architecture (LIVE)

The UI tracks long-running async operations as typed **background jobs** with a shared lifecycle (`pending` → `running` → `succeeded` / `failed` / `aborted`). A Zustand store holds in-memory state, IndexedDB provides persistence, and a Service Worker executes backend API work.

The v1 system coupled auto-start to MusicPanel's lifecycle — jobs created while MusicPanel was unmounted were saved to IndexedDB but never started. v2 centralizes orchestration in a single app-level provider (`JobOrchestratorProvider`), mounted once in `main.tsx`, always alive.

---

## Architecture

```
main.tsx
┌──────────────────────────────────────────────────────────────────┐
│  <JobOrchestratorProvider>                                        │
│                                                                   │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │  JobOrchestratorProvider                                     │ │
│  │                                                               │ │
│  │  Owns:                                                        │ │
│  │   • IndexedDB ↔ Zustand sync (TaskJobRecord → BackgroundJob) │ │
│  │   • SW message bridge (generic, driven by jobTypeRegistry)   │ │
│  │   • Auto-start queue — one running job per (type, folder)    │ │
│  │   • Lifecycle — startup reconciliation, SW reactivation     │ │
│  │   • parentId batch cancellation on failure                   │ │
│  │                                                               │ │
│  │  Exposes via React Context + window.__jobOrchestrator:        │ │
│  │   • Imperative: createJob, createJobs, startJob, stopJob,    │ │
│  │     removeJob                                                 │ │
│  │   • Reactive: useFileStatuses(folder, type), useJobs()       │ │
│  └──────────────────────┬──────────────────────────────────────┘ │
│                         │                                          │
│  ┌──────────────────────┼──────────────────────────────────────┐ │
│  │              Consumers (via useJobManager / context)          │ │
│  │         ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌───────────┐  │ │
│  │         │MusicPanel│ │ Dialogs │ │  Menu   │ │   MCP     │  │ │
│  │         └─────────┘ └─────────┘ └─────────┘ └───────────┘  │ │
│  └──────────────────────────────────────────────────────────────┘ │
│                         │                                          │
│  ┌──────────────────────┼──────────────────────────────────────┐ │
│  │              Persistence Layer                                │ │
│  │  ┌──────────────────┐  ┌──────────────────────────────────┐ │ │
│  │  │  Zustand Store   │  │  IndexedDB (DownloadTaskDatabase) │ │ │
│  │  │  (in-memory)     │  │  (durable, synced on events)      │ │ │
│  │  └──────────────────┘  └──────────────────────────────────┘ │ │
│  └──────────────────────────────────────────────────────────────┘ │
│                         │ postMessage                              │
│  ┌──────────────────────┼──────────────────────────────────────┐ │
│  │     Service Worker (download-service-worker.js)              │ │
│  │     startDownload / startTranscribe / startTranslate /       │ │
│  │     startSynthesize / startProcess / startTestDelay          │ │
│  └──────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────┘
```

### Mount point

`JobOrchestratorProvider` wraps the entire app in `main.tsx`:

```
<QueryClientProvider>
  <ThemeProvider>
    <JobOrchestratorProvider>   ← always mounted
      <DialogProvider>
        <AppSwitcher />
      </DialogProvider>
    </JobOrchestratorProvider>
  </ThemeProvider>
</QueryClientProvider>
```

This guarantees jobs are auto-started regardless of which panel is active.

---

## Core components

### 1. `JobTypeRegistry` — the single extension point

**File:** `src/lib/jobTypeRegistry.ts`

A standalone data module. Adding a new job type means adding one entry here. The orchestrator reads this registry generically — it never references specific types.

```typescript
export interface JobTypeConfig {
  /** SW message prefix: `${prefix}:start`, `${prefix}:stop`, `${prefix}:remove` */
  messagePrefix: string
  /** localStorage key for auto-start toggle */
  autoStartKey: string
  /**
   * Extracts a stable file/entity path from job data.
   * Used by useFileStatuses() for "is file X currently processing?" queries.
   */
  extractPath: (data: unknown) => string
  /** Optional lifecycle toasts for this type. */
  toasts?: {
    started?: (t: TFunction) => string
    succeeded?: (t: TFunction) => string
    failed?: (t: TFunction) => string
  }
}

export const JOB_TYPE_REGISTRY: Record<string, JobTypeConfig> = {
  'download-video': { ... },
  'transcribe':     { ... },
  'translate':      { ... },
  'synthesize':     { ... },
  'process':        { ... },
}

export const ALL_JOB_TYPES = Object.keys(JOB_TYPE_REGISTRY)
```

`swEventNames(prefix)` derives the full set of SW channel names from the prefix (e.g. `'download'` → `{ start: 'download:start', succeeded: 'download:succeeded', ... }`).

### 2. `JobOrchestratorProvider` — app-level orchestrator

**File:** `src/components/JobOrchestratorProvider.tsx`

The single source of truth for all background job operations. It has **no per-type branches** — all type-specific behavior comes from the registry.

#### State

| State | Source | Purpose |
|---|---|---|
| `jobRecords: TaskJobRecord[]` | IndexedDB, synced on events | Durable source of truth, filtered to within-1-hour |
| `popoverJobRecords: TaskJobRecord[]` | IndexedDB | Status-bar popover (24h window, up to 100 records) |
| `swReady: boolean` | SW registration | Whether the SW is ready to accept messages |
| `jobRecordsRef` | Mutable ref mirroring `jobRecords` | Avoids stale closures in callbacks |

All concurrency checks are inline against `jobRecordsRef.current` (there is no separate `runningSet` map; the guard checks `records.some(r => r.status === 'running')` for the same `(type, folder)`).

#### Lifecycle

```
On mount:
  1. Eager-load IndexedDB records (no SW dependency)
  2. Register the SW, wait for 'ready' + controllerchange
  3. handleSwReactivate() → mark leftover running jobs as aborted
  4. Sync all jobs, set swReady=true
  5. tryAutoStartAll() for every (type, folder) combination

On SW message (download:succeeded, transcribe:failed, ...):
  1. Match message to job type via registry
  2. Show toast if configured
  3. Sync from IndexedDB → get fresh records
  4. On failed: cancel pending siblings by parentId (see §Batch cancellation)
  5. tryAutoStart for the same (type, folder)

On indexed-updated event:
  1. Sync from IndexedDB
  2. tryAutoStartAll()

Poll safety net:
  - While pending or running jobs exist, poll IndexedDB every 5 seconds
```

#### SW message handler

A single `navigator.serviceWorker.addEventListener('message', handler)` in a `useEffect`. The handler is **generic** — it matches any event to a registered type via `ALL_JOB_TYPES.find(t => swEventNames(registry[t].messagePrefix) includes msg.event)`. No per-type `if` / `switch` branches.

### 3. `useJobManager` — unified facade hook

**File:** `src/hooks/useJobManager.ts`

The public API for React components. Combines Zustand store (for in-memory `generic` jobs and reactive state) with JobOrchestrator context (for IndexedDB-backed persisted jobs).

```typescript
export interface UseJobManagerResult {
  jobs: BackgroundJob[]
  refreshFromIndexedDB: (source?: string) => Promise<void>
  isReady: boolean
  createJob: (job: BackgroundJob) => Promise<string>
  createJobs: (jobs: BackgroundJob[]) => Promise<{ successIds, failures }>
  startJob: (id: string, options?: { forceStart?: boolean }) => Promise<StartJobResult>
  stopJob: (id: string) => void
  removeJob: (id: string) => Promise<void>
  clearRemovableJobs: () => Promise<void>
  addJob: (nameOrJob: string | BackgroundJob) => string
  updateJob: (id: string, updates: Partial<BackgroundJob>) => void
  patchJob: (id: string, fn: (job: BackgroundJob) => BackgroundJob) => void
}
```

`stopJob` and `removeJob` dispatch by job type:
- `generic` → Zustand store directly (in-memory only)
- `test-delay` → `testDelayJobRunner` helpers
- All others → orchestrator (IndexedDB + SW)

### 4. `useJobOrchestrator` — re-export barrel

**File:** `src/hooks/useJobOrchestrator.ts`

Thin re-export module providing a single import namespace for the orchestrator ecosystem:

```typescript
export { useJobManager } from './useJobManager'
export { useJobOrchestratorContext as useJobOrchestrator, useFileStatuses, useJobs } from '@/components/JobOrchestratorProvider'
```

### 5. `backgroundJobsStore` — Zustand store

**File:** `src/stores/backgroundJobsStore.ts`

In-memory job list. Handles `generic` job lifecycle directly (add, abort, remove). For persisted jobs, the store is synced from IndexedDB by `syncJobRecordsToStore()` — persisted jobs are replaced wholesale while in-memory generic jobs are preserved.

### 6. `downloadTaskDb` — IndexedDB persistence layer

**File:** `src/lib/downloadTaskDb.ts`

Schema (`DownloadTaskDatabase` / `jobs` store):

```typescript
export interface TaskJobRecord {
  id: string
  name: string
  status: string        // pending | running | failed | succeeded | aborted
  progress: number      // 0–100
  type: string          // discriminator (download-video, transcribe, …)
  folder: string        // filesystem folder for (type, folder) scoping
  data?: string         // JSON-serialized type-specific payload
  parentId?: string     // batch identifier for failure cascading
  createdAt: number
  updatedAt: number
}
```

Key functions: `getAllJobs()`, `putJob()`, `deleteJob()`, `getJobsByTypeAndFolder()`, `cancelPendingJobsByParentId()`, `notifyIndexedDbUpdated()`.

Auto-start window: jobs created within the last hour (`isWithinOneHour`). UI popover window: 24 hours, up to 100 jobs.

### 7. `jobRecordMapper` — IndexedDB → BackgroundJob conversion

**File:** `src/lib/jobRecordMapper.ts`

`jobRecordToBackgroundJob(record)` — converts a `TaskJobRecord` to the appropriate typed `BackgroundJob` based on `record.type`. Each type has its own deserialization logic for `data` (JSON.parse + field mapping). `syncJobRecordsToStore(records)` replaces all persisted jobs in the Zustand store, preserving in-memory `generic` jobs.

### 8. `window.__jobOrchestrator` bridge

**File:** `src/components/JobOrchestratorProvider.tsx` (lines 513–525)
**Type declaration:** `src/types/global.d.ts`

Exposes the imperative API on `window` for non-React consumers (MCP tools, tests):

```typescript
window.__jobOrchestrator = {
  createJob(job: BackgroundJob): Promise<string>
  createJobs(jobs: BackgroundJob[]): Promise<{ successIds, failures }>
  startJob(id: string, options?: { forceStart?: boolean }): Promise<StartJobResult>
  stopJob(id: string): void
  removeJob(id: string): Promise<void>
  isReady(): boolean
}
```

---

## Job types

### 1. `download-video`

Download media files via yt-dlp. Tracks each video in a multi-video job with per-item sub-statuses.

- **Interface:** `DownloadVideoBackgroundJob` (type: `'download-video'`)
- **Data:** `{ folder, videos: [{ url, artist, title, status }], ytdlpFormat?, ytdlpCookiesFile?, ytdlpCookiesFromBrowser?, ytdlpExtraArgs?, executionId?, logRelativePath? }`
- **Factory:** `lib/downloadVideoJobFactory.ts` — `buildDownloadVideoJob()`
- **SW handler:** `startDownload` → `POST /api/ytdlp/download`
- **Sub-status:** `DownloadVideoItemStatus` — `pending → downloading → succeeded | failed`
- **Heartbeat:** `download:heartbeat` every 20s
- **Registry `extractPath`:** `data.videos[0].url`

### 2. `transcribe`

Speech-to-text via VideoCaptioner CLI or Tencent ASR.

- **Interface:** `TranscribeBackgroundJob` (type: `'transcribe'`)
- **Data:** `{ folder, mediaPath, mediaPathPlatform, title, provider, videoCaptioner?, tencentAsr?, executionId?, logRelativePath? }`
- **Factory:** `lib/transcribeJobFactory.ts` — `buildTranscribeJob()`
- **SW handler:** `startTranscribe` → `POST /api/videocaptioner/transcribe` or Tencent ASR API
- **Registry `extractPath`:** `data.mediaPath`

### 3. `translate`

Translate subtitle files via VideoCaptioner.

- **Interface:** `TranslateBackgroundJob` (type: `'translate'`)
- **Data:** `{ folder, subtitlePath, subtitlePathPlatform, title, translator, targetLanguage, mediaPath?, reflect?, layout?, llm?, executionId?, logRelativePath? }`
- **Factory:** `lib/translateJobFactory.ts` — `buildTranslateJob()`
- **SW handler:** `startTranslate` → `POST /api/videocaptioner/translate`
- **Registry `extractPath`:** `data.mediaPath || data.subtitlePath`

### 4. `synthesize`

Burn subtitles into video (soft/hard) via VideoCaptioner.

- **Interface:** `SynthesizeBackgroundJob` (type: `'synthesize'`)
- **Data:** `{ folder, videoPath, videoPathPlatform, subtitlePath, subtitlePathPlatform, title, subtitleMode?, quality?, style?, renderMode?, layout?, executionId?, logRelativePath? }`
- **Factory:** `lib/synthesizeJobFactory.ts` — `buildSynthesizeJob()`
- **SW handler:** `startSynthesize` → `POST /api/videocaptioner/synthesize`
- **Registry `extractPath`:** `data.mediaPath || data.videoPath`

### 5. `process`

Full pipeline: transcribe → translate → synthesize in one API call.

- **Interface:** `ProcessBackgroundJob` (type: `'process'`)
- **Data:** Includes all transcribe + translate + synthesize options plus pipeline flags (`noOptimize`, `noTranslate`, `noSplit`, `noSynthesize`)
- **Factory:** `lib/processJobFactory.ts` — `buildProcessJob()`
- **SW handler:** `startProcess` → `POST /api/videocaptioner/process`
- **Registry `extractPath`:** `data.mediaPath`

### 6. `generic`

In-memory-only placeholder jobs for simple named operations.

- **Interface:** `GenericBackgroundJob` (type: `'generic'`)
- **Data:** `Record<string, never>` (empty object)
- **Persistence:** Not persisted to IndexedDB
- **Execution:** In-process (no SW)
- **Example:** `addJob("Importing Media Library")`

### 7. `test-delay`

Developer test job with configurable delay and outcome. Persisted in IndexedDB and executed by a dedicated in-process runner (not the SW).

- **Interface:** `TestDelayBackgroundJob` (type: `'test-delay'`)
- **Data:** `{ delayMs: number, outcome: 'succeeded' | 'failed', startedAt?: number }`
- **Runner:** `src/lib/testDelayJobRunner.ts` (in-process `setTimeout`)
- **Persistence:** Persisted to IndexedDB, survives page refresh via `startedAt` resume

---

## Job lifecycle

```
         ┌──────────┐
         │  pending  │
         └─────┬─────┘
               │ start (SW message)
         ┌─────▼──────┐
         │   running   │
         └──┬──────┬───┘
            │      │
     ┌──────▼─┐ ┌──▼───────┐
     │succeeded│ │  failed   │
     └────────┘ └─────┬─────┘
                      │
            ┌─────────▼──────────┐
            │ cancelPendingJobs  │  ← if parentId is set, cancel siblings
            │ ByParentId()       │
            └────────────────────┘
```

All jobs start as `pending`, transition to `running` when the SW picks them up, and end as `succeeded`, `failed`, or `aborted` (user-initiated cancel). The SW also has a `stopped` state used when the SW itself stops mid-job.

---

## Concurrency model

```
Rules:
  • Max 1 running job per (type, folder) pair
  • Different types can run concurrently in the same folder
  • Different folders are fully independent
  • Unknown types (not in registry) are persisted but never auto-started

Examples:
  "C:/Music"  → { download }            ← 1 running
  "C:/Music"  → { download, transcribe } ← OK: different types
  "D:/Videos" → { download }            ← OK: different folder
  "D:/Videos" → { download }            ← BLOCKED: same type+folder has running
```

When a job finishes (`succeeded`, `failed`, or `stopped`), the orchestrator calls `tryAutoStart(type, folder)` to start the next `pending` job in the same `(type, folder)` queue.

### `startJob` semantics

- `startJob(id, { forceStart: false })` — default. Respects concurrency: returns `concurrency-blocked` if same `(type, folder)` already has a running job. The job stays pending and will be picked up by the scheduler.
- `startJob(id, { forceStart: true })` — bypasses concurrency guard and auto-start toggle. For explicit user-initiated starts.

---

## Batch cancellation (`parentId`)

When a batch of jobs is created together, they share a `parentId`. If one job in the batch fails, all pending siblings are automatically cancelled **before** the orchestrator starts the next job in the queue.

### How it works

1. **Creation:** The caller generates a `parentId` (e.g. `createDownloadVideoJobId()`) and sets it on each job before calling `createJob()` / `createJobs()`.
2. **Persistence:** `parentId` is stored in the `TaskJobRecord` in IndexedDB.
3. **Failure handling:** When the SW reports a job failure, the orchestrator:
   - Looks up the failed job's `parentId` from `jobRecordsRef.current`
   - Calls `cancelPendingJobsByParentId(parentId)` — finds all `pending` records with the same `parentId` and marks them `aborted`
   - Re-syncs from IndexedDB (so the cancelled jobs are reflected)
   - Calls `tryAutoStart()` — which finds no more pending jobs for that batch

### Scope

`parentId` is a **generic** field on `BackgroundJobBase` — any job type can use it. The cancellation logic lives in the orchestrator's SW message handler (not in any type-specific code), so all job types get batch-cancellation behavior automatically.

### Current usage

`useYtdlpDownloadFlow` (download video dialog) sets a `parentId` when creating multiple download jobs (multi-episode or collection downloads). A single-video download does not set `parentId`.

### Types

```typescript
// BackgroundJobBase
parentId?: string

// TaskJobRecord (IndexedDB)
parentId?: string
```

### Key files

| File | Role |
|---|---|
| `src/types/background-jobs.ts` | `parentId` on `BackgroundJobBase` |
| `src/lib/downloadTaskDb.ts` | `parentId` on `TaskJobRecord`; `cancelPendingJobsByParentId()` |
| `src/lib/jobRecordMapper.ts` | Maps `parentId` from record → job |
| `src/components/JobOrchestratorProvider.tsx` | Cancellation logic in SW message handler |
| `src/lib/downloadVideoJobFactory.ts` | Accepts `parentId` in `CreateDownloadVideoJobInput` |
| `src/components/dialogs/hooks/use-ytdlp-download-flow.ts` | Generates `parentId` for batch downloads |

---

## SW message protocol

The client and Service Worker communicate via `postMessage` with a standard event naming convention:

```
<prefix>:start     — client → SW: start a job
<prefix>:stop      — client → SW: stop a running job
<prefix>:remove    — client → SW: remove a job

<prefix>:started   — SW → client: job has started
<prefix>:succeeded — SW → client: job completed successfully
<prefix>:failed    — SW → client: job failed
<prefix>:stopped   — SW → client: job was stopped
<prefix>:removed   — SW → client: job was removed
<prefix>:heartbeat — SW → client: periodic progress ping (every 20s)
```

Each registered type has its own prefix (e.g. `download`, `transcribe`, `translate`, `synthesize`, `process`).

---

## Reactive hooks

### `useFileStatuses(folder, type)`

Provided by `JobOrchestratorProvider`. Answers "is file X currently running/pending/failed?" for UI rendering (e.g. MusicPanel table row status indicators).

```typescript
function useFileStatuses(folder: string, type: string): {
  runningPaths: Set<string>
  pendingPaths: Set<string>
  failedPaths: Set<string>
  /** All job IDs per path (supports multiple jobs on the same file) */
  jobIdsByPath: Map<string, string[]>
  /** Preferred job ID per path: running > pending > failed > first */
  primaryJobIdByPath: Map<string, string>
}
```

Driven entirely by the registry's `extractPath` — no per-type branches.

### `useJobs()`

Convenience alias for `useJobOrchestratorContext().jobRecords`.

---

## Adding a new job type

Adding `trim-video` requires exactly **4 steps**. No changes to the orchestrator, store, or IndexedDB layer.

### Step 1: Create the factory (`lib/trimVideoJobFactory.ts`)

```typescript
export function buildTrimVideoJob(input: {
  folder: string
  videoPath: string
  title: string
  startTime: number
  endTime: number
}): BackgroundJob {
  return {
    id: createTrimVideoJobId(),
    name: input.title,
    status: 'pending',
    progress: 0,
    type: 'trim-video',
    data: { folder: input.folder, videoPath: input.videoPath, startTime: input.startTime, endTime: input.endTime },
  }
}
```

### Step 2: Add registry entry (`lib/jobTypeRegistry.ts`)

```typescript
'trim-video': {
  messagePrefix: 'trim-video',
  autoStartKey: 'trim-video.autoStart',
  extractPath: (data) => (data as any)?.videoPath ?? '',
  toasts: {
    started: (t) => t('trimVideoDialog.toastStart'),
    succeeded: (t) => t('trimVideoDialog.toastSucceeded'),
    failed: (t) => t('trimVideoDialog.toastFailed'),
  },
},
```

### Step 3: Add SW handler (`public/download-service-worker.js`)

```javascript
async function startTrimVideo(jobId) { /* POST /api/trim */ }

// In the message dispatch:
case 'trim-video:start':  startTrimVideo(msg.id); break
case 'trim-video:stop':   stopTrimVideo(msg.id); break
case 'trim-video:remove': removeTrimVideo(msg.id); break
```

### Step 4: Build the UI dialog

Import `useJobManager`, call `createJob(buildTrimVideoJob(...))`.

### Step 5: Add type definition and job record mapping

Add the new interface to `types/background-jobs.ts` (extending `BackgroundJobBase`) and add a deserialization branch in `jobRecordMapper.ts`.

### Files NOT touched

- `JobOrchestratorProvider.tsx`
- `stores/backgroundJobsStore.ts`
- `lib/downloadTaskDb.ts`
- `hooks/useJobOrchestrator.ts`
- `hooks/useJobManager.ts`

---

## Key files

| File | Role |
|---|---|
| `src/types/background-jobs.ts` | Type definitions, type guards, `parentId` |
| `src/types/global.d.ts` | `window.__jobOrchestrator` type declaration |
| `src/stores/backgroundJobsStore.ts` | Zustand store (add, update, abort, remove) |
| `src/lib/downloadTaskDb.ts` | IndexedDB persistence, `cancelPendingJobsByParentId()` |
| `src/lib/jobRecordMapper.ts` | IndexedDB record → typed job conversion |
| `src/lib/jobTypeRegistry.ts` | Type metadata registry (single extension point) |
| `src/lib/downloadVideoJobFactory.ts` | Download-video job builder |
| `src/lib/transcribeJobFactory.ts` | Transcribe job builder |
| `src/lib/translateJobFactory.ts` | Translate job builder |
| `src/lib/synthesizeJobFactory.ts` | Synthesize job builder |
| `src/lib/processJobFactory.ts` | Process (full pipeline) job builder |
| `src/lib/testDelayJobRunner.ts` | In-process test-delay job runner |
| `src/lib/backgroundJobLifecycle.ts` | Job status predicates (removable, terminal, etc.) |
| `src/components/JobOrchestratorProvider.tsx` | App-level orchestrator + reactive hooks |
| `src/hooks/useJobManager.ts` | Unified facade hook (store + orchestrator) |
| `src/hooks/useJobOrchestrator.ts` | Re-export barrel |
| `src/components/dialogs/hooks/use-ytdlp-download-flow.ts` | Download dialog flow + `parentId` generation |
| `src/components/eventlisteners/FixedDelayBackgroundJobHandler.tsx` | Test-delay job event handler |
| `src/components/eventlisteners/MediaLibraryImportedEventHandler.tsx` | Media library import (generic jobs) |
| `src/components/background-jobs/` | StatusBar popover UI components |
| `public/download-service-worker.js` | Service Worker (executes all job types) |

---

## Non-goals

- **Changing the IndexedDB schema** beyond additive fields. The `TaskJobRecord` structure handles arbitrary types already.
- **Real-time progress for non-download jobs.** The SW heartbeat mechanism covers all types.
- **Job priority or cross-type ordering.** Jobs are FIFO within each `(type, folder)` queue.
- **Transaction semantics for `createJobs`.** Bulk creation is non-transactional — each job succeeds or fails independently, and the caller retries failures.
