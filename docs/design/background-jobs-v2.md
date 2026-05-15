# Background Jobs — v2 Architecture

## Problem statement

The current background job system has structural issues that make it fragile and hard to extend:

1. **Auto-start is coupled to MusicPanel's lifecycle.** `useJobManager` (and all per-type managers wrapping it) are only instantiated when MusicPanel is mounted. Jobs created from the menu, MCP, or any other source while MusicPanel is unmounted are saved to IndexedDB but never picked up.

2. **Auto-start is scoped to a single folder.** `useJobManager` queries `getJobsByTypeAndFolder(jobType, platformFolder)` — where `platformFolder` is the MusicPanel's currently selected folder. A job saved for a different folder is invisible to the manager and never starts.

3. **Five nearly-identical manager hooks** (`useDownloadManager`, `useTranscribeManager`, `useTranslateManager`, `useSynthesizeManager`, `useProcessManager`) each call `useJobManager` with different parameters and parse `jobRecords` into per-file status sets. This duplication is noise — they differ only in the `mediaPath` extraction logic.

4. **No imperative API for external consumers.** Menu, MCP tools, and tests have no way to create or start jobs except by writing directly to IndexedDB and dispatching `indexed-updated` — a fire-and-hope pattern with no feedback.

5. **Tight coupling between UI and plumbing.** Components that only need to know "is file X currently being transcribed?" must import and instantiate a full `useTranscribeManager` with SW listeners and auto-start logic — even if they never start jobs themselves.

6. **Adding a new job type is invasive.** It requires changes across hook files, manager files, the orchestrator's type definitions, and duplicate SW message handling logic. There is no single, isolated extension point.

---

## Goals

1. **Decouple job creation from job execution.** Any source (MusicPanel, menu, MCP, test) can create a job and it will reliably start.
2. **Centralize orchestration.** A single, app-level component owns the IndexedDB ↔ Zustand ↔ Service Worker bridge, mounted once, always alive.
3. **Unify per-type management.** One orchestrator handles all job types, eliminating duplicated SW message handling and `indexed-updated` event listeners.
4. **Provide a clean API surface.** A React context exposes imperative methods for creating, starting, aborting, and removing jobs. A companion hook provides reactive per-folder status queries for UI rendering.
5. **Keep the existing persistence layer.** IndexedDB (`downloadTaskDb.ts`) and the Service Worker (`download-service-worker.js`) remain unchanged — the refactor is above them.
6. **Make new job types a data-level change.** Adding a job type should only require: (a) a new factory function, (b) a new registry entry, (c) the SW handler for that type, and (d) the UI dialog. No changes to the orchestrator, store, or IndexedDB layer.

---

## Architecture overview

> 2026-05-15 决策更新：本版补充了 `startJob(id, options)` 强制启动语义、`createJobs` 非事务语义，以及 `useFileStatuses` 对“同一路径多任务”的支持。若与旧段落冲突，以本版更新为准。

```
┌──────────────────────────────────────────────────────────────────┐
│                      App Root (always mounted)                    │
│                                                                   │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │                 JobOrchestratorProvider                       │ │
│  │                                                               │ │
│  │  Imports:                                                     │ │
│  │   • jobTypeRegistry          — type metadata (data only)     │ │
│  │   • backgroundJobsStore      — Zustand                       │ │
│  │   • downloadTaskDb functions — IndexedDB                     │ │
│  │                                                               │ │
│  │  Does NOT import:                                            │ │
│  │   • Any job factory                                         │ │
│  │   • Any job-type-specific types                              │ │
│  │   • Any per-type hook or manager                             │ │
│  │                                                               │ │
│  │  Owns:                                                        │ │
│  │   • IndexedDB ↔ Zustand sync                                 │ │
│  │   • SW message bridge (generic, driven by registry)          │ │
│  │   • Auto-start queue — one running job per (type, folder)    │ │
│  │   • Lifecycle — startup reconciliation, SW reactivation     │ │
│  │                                                               │ │
│  │  Exposes via React Context:                                   │ │
│  │   • Imperative: createJob(job), startJob(id, options),        │ │
│  │     createJobs(jobs), stopJob(id),                            │ │
│  │     removeJob(id)                                             │ │
│  │   • Reactive: useFileStatuses(folder, type), useJobs(),      │ │
│  │     useJobIndicatorState()                                    │ │
│  └──────────────────────┬──────────────────────────────────────┘ │
│                         │ React Context                            │
│         ┌───────────────┼───────────────┬──────────────┐          │
│         │               │               │              │          │
│  ┌──────▼──────┐ ┌──────▼──────┐ ┌──────▼──────┐ ┌─────▼──────┐ │
│  │ MusicPanel  │ │    Menu     │ │  MCP Tool   │ │ Any future │ │
│  │ (reads      │ │ (creates    │ │ (creates    │ │ consumer   │ │
│  │  status +   │ │  download   │ │  any job    │ │            │ │
│  │  creates    │ │  jobs)      │ │  type)      │ │            │ │
│  │  jobs)      │ │             │ │             │ │            │ │
│  └─────────────┘ └─────────────┘ └─────────────┘ └────────────┘ │
└──────────────────────────────────────────────────────────────────┘
```

---

## Core components

### 1. `JobTypeRegistry` — the single extension point

A standalone data module. Adding a new job type means adding one entry here. The orchestrator reads this registry generically — it never references specific types.

```typescript
// src/lib/jobTypeRegistry.ts

import type { BackgroundJob } from '@/types/background-jobs'

/** Everything the orchestrator needs to handle a job type generically. */
export interface JobTypeConfig {
  /** SW message prefix: `${prefix}:start`, `${prefix}:stop`, `${prefix}:remove` */
  messagePrefix: string

  /** localStorage key for auto-start preference; e.g. 'download.autoStart' */
  autoStartKey: string

  /**
   * Extracts a stable file/entity path from job data.
   * Used by useFileStatuses() to answer "is file X currently processing?"
   * Returns empty string when no path association is needed.
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

  'download-video': {
    messagePrefix: 'download',
    autoStartKey: 'download.autoStart',
    extractPath: (data) => (data as any)?.videos?.[0]?.url ?? '',
  },

  'transcribe': {
    messagePrefix: 'transcribe',
    autoStartKey: 'transcribe.autoStart',
    extractPath: (data) => (data as any)?.mediaPath ?? '',
  },

  'translate': {
    messagePrefix: 'translate',
    autoStartKey: 'translate.autoStart',
    extractPath: (data) => {
      const d = data as any
      return d.mediaPath || d.subtitlePath || ''
    },
    toasts: {
      started: (t) => t('subtitleTranslationDialog.toastStart'),
      succeeded: (t) => t('subtitleTranslationDialog.toastSucceeded'),
      failed: (t) => t('subtitleTranslationDialog.toastFailed'),
    },
  },

  'synthesize': {
    messagePrefix: 'synthesize',
    autoStartKey: 'synthesize.autoStart',
    extractPath: (data) => {
      const d = data as any
      return d.mediaPath || d.videoPath || ''
    },
    toasts: {
      started: (t) => t('synthesizeSubtitleDialog.toastStart'),
      succeeded: (t) => t('synthesizeSubtitleDialog.toastSucceeded'),
      failed: (t) => t('synthesizeSubtitleDialog.toastFailed'),
    },
  },

  'process': {
    messagePrefix: 'process',
    autoStartKey: 'process.autoStart',
    extractPath: (data) => (data as any)?.mediaPath ?? '',
    toasts: {
      started: (t) => t('processPipelineDialog.toastStart'),
      succeeded: (t) => t('processPipelineDialog.toastSucceeded'),
      failed: (t) => t('processPipelineDialog.toastFailed'),
    },
  },
}

/** All registered job type keys. */
export const ALL_JOB_TYPES = Object.keys(JOB_TYPE_REGISTRY)

/**
 * Derive the SW event names for a given type.
 * e.g. for 'download' → { start: 'download:start', stop: 'download:stop', ... }
 */
export function swEventNames(prefix: string) {
  return {
    start: `${prefix}:start`,
    stop: `${prefix}:stop`,
    remove: `${prefix}:remove`,
    started: `${prefix}:started`,
    succeeded: `${prefix}:succeeded`,
    failed: `${prefix}:failed`,
    stopped: `${prefix}:stopped`,
    removed: `${prefix}:removed`,
    heartbeat: `${prefix}:heartbeat`,
  }
}
```

**Adding a new job type `trim-video` requires:**
1. A factory `buildTrimVideoJob()` that returns a `BackgroundJob` with `type: 'trim-video'`
2. A `'trim-video'` entry in `JOB_TYPE_REGISTRY`
3. A `startTrimVideo` handler in the SW
4. The UI dialog

**Does NOT require changing:**
- `JobOrchestratorProvider.tsx` (zero changes)
- `backgroundJobsStore.ts` (zero changes)
- `downloadTaskDb.ts` (zero changes)
- `useJobOrchestrator.ts` (zero changes)

---

### 2. `JobOrchestratorProvider` (new, app-level)

A React component wrapping the entire app. It is the single source of truth for all background job operations. It has **no per-type branches** — all type-specific behavior comes from the registry.

#### What it imports (and what it doesn't)

```typescript
// Allowed imports:
import { JOB_TYPE_REGISTRY, ALL_JOB_TYPES, swEventNames } from '@/lib/jobTypeRegistry'
import { useBackgroundJobsStore } from '@/stores/backgroundJobsStore'
import {
  getAllJobs, getJobsByTypeAndFolder, putJob, deleteJob,
  notifyIndexedDbUpdated, type TaskJobRecord,
} from '@/lib/downloadTaskDb'

// NEVER imports:
// - Any *JobFactory file
// - Any type-specific types (TranscribeBackgroundJob, etc.)
// - useJobManager, useDownloadManager, or any per-type hook
```

#### State it owns

| State | Source | Purpose |
|---|---|---|
| `jobRecords: TaskJobRecord[]` | IndexedDB, synced on events | Persisted records — the durable source of truth |
| `swReady: boolean` | SW registration | Whether the Service Worker is ready to accept messages |
| `runningSet: Map<string, Set<string>>` | Derived: `folder → Set<jobType>` | Concurrency guard: one running job per (type, folder) |

#### Lifecycle

```
On mount:
  1. Register the SW, wait for 'ready'
  2. Call handleSwReactivate() → mark leftover running jobs as stopped/aborted
  3. Load all jobs from IndexedDB, sync to Zustand store
  4. Attach a single SW onmessage listener (driven by ALL_JOB_TYPES)
  5. For each combination of (registered_type × distinct_folder), try auto-start

On SW message (download:started, transcribe:succeeded, ...):
  1. Re-sync IndexedDB → Zustand
  2. If a job succeeded/failed/stopped, detect the type via registry,
     dequeue, and auto-start the next pending job of the same (type, folder)

On indexed-updated event:
  1. Re-sync IndexedDB → Zustand
  2. For any new pending jobs, try auto-start
```

#### SW message handler (generic, no per-type branches)

```typescript
// Inside the orchestrator, the single SW message listener:

function handleSwMessage(msg: { event: string; id?: string }) {
  if (!msg.id) return

  // Heartbeats are no-ops on the client side
  if (msg.event.endsWith(':heartbeat')) return

  // Determine the job type from the message event
  // e.g. "download:started" → type = "download-video"
  const matchedType = ALL_JOB_TYPES.find(t => {
    const events = swEventNames(JOB_TYPE_REGISTRY[t].messagePrefix)
    return Object.values(events).includes(msg.event)
  })

  if (!matchedType) return  // unknown event, ignore

  const prefix = JOB_TYPE_REGISTRY[matchedType].messagePrefix
  const events = swEventNames(prefix)

  // Handle completion events
  if (msg.event === events.succeeded || msg.event === events.failed || msg.event === events.stopped) {
    // Show toast if configured
    if (matchedType && JOB_TYPE_REGISTRY[matchedType].toasts) {
      const toastFn = msg.event === events.succeeded
        ? JOB_TYPE_REGISTRY[matchedType].toasts!.succeeded
        : msg.event === events.failed
          ? JOB_TYPE_REGISTRY[matchedType].toasts!.failed
          : null
      if (toastFn) toast[msg.event === events.succeeded ? 'success' : 'error'](toastFn(t))
    }

    // Find job to determine its folder, then auto-start next
    const job = jobRecords.find(r => r.id === msg.id)
    if (job) {
      syncFromIndexedDB()
      tryAutoStart(matchedType, job.folder)
    }
    return
  }

  // For 'started' events, just re-sync
  if (msg.event === events.started) {
    if (matchedType && JOB_TYPE_REGISTRY[matchedType].toasts?.started) {
      toast.info(JOB_TYPE_REGISTRY[matchedType].toasts!.started!(t))
    }
    syncFromIndexedDB()
    return
  }

  // For 'removed' events
  if (msg.event === events.removed) {
    syncFromIndexedDB()
  }
}
```

#### Auto-start algorithm (generic, driven by registry)

```typescript
function tryAutoStart(type: string, folder: string): void {
  if (!swReady) return

  const config = JOB_TYPE_REGISTRY[type]
  if (!config) return

  // Check auto-start preference
  const autoStart = localStorage.getItem(config.autoStartKey) !== 'false'
  if (!autoStart) return

  // Concurrency guard: max 1 running per (type, folder)
  const running = runningSet.get(folder)
  if (running?.has(type)) return

  // Find next pending job
  const records = await getJobsByTypeAndFolder(type, folder, { excludeSucceeded: true })
  const next = records.find(r => r.status === 'pending' && r.status !== 'stopped' && r.status !== 'aborted')
  if (!next) return

  // Dispatch to SW
  const { start } = swEventNames(config.messagePrefix)
  navigator.serviceWorker?.controller?.postMessage({ event: start, id: next.id })
}

function tryAutoStartAll(): void {
  // On startup or after a large sync, try every (type, folder) combination
  for (const type of ALL_JOB_TYPES) {
    const records = await getAllJobs()
    const folders = new Set(records.filter(r => r.type === type).map(r => r.folder))
    for (const folder of folders) {
      tryAutoStart(type, folder)
    }
  }
}
```

#### Imperative API（通过 context 暴露）

```typescript
interface JobOrchestratorAPI {
  /**
   * Persist a pre-built BackgroundJob to IndexedDB, sync to Zustand,
   * and trigger auto-start for its (type, folder).
   *
   * The caller is responsible for building the job using the appropriate
   * factory (e.g. buildDownloadVideoJob, buildTranscribeJob).
   */
  createJob(job: BackgroundJob): Promise<string>

  /**
   * 批量写入任务（非事务）。
   * - 不保证 all-or-nothing
   * - 单条写入失败不回滚已成功写入项
   * - 返回逐项结果，便于调用方重试失败项
   */
  createJobs(jobs: BackgroundJob[]): Promise<{
    successIds: string[]
    failures: Array<{ job: BackgroundJob; error: string }>
  }>

  /**
   * 启动指定任务。
   *
   * 默认（forceStart=false）不抢占：若同(type, folder)已有running任务，
   * 直接返回 concurrency-blocked，由调度器后续自动启动。
   *
   * forceStart=true 时强制启动：
   * - 绕过 auto-start 开关
   * - 即使已有同(type, folder) running任务也允许启动
   */
  startJob(
    id: string,
    options?: { forceStart?: boolean },
  ): Promise<
    | { started: true }
    | {
        started: false
        reason:
          | 'sw-not-ready'
          | 'job-not-found'
          | 'invalid-job-type'
          | 'concurrency-blocked'
      }
  >

  /** Stop (abort) a running job. */
  stopJob(id: string): void

  /** Remove a job from IndexedDB and the store. */
  removeJob(id: string): Promise<void>

  /** SW 是否已就绪并可接收消息。 */
  isReady: boolean
}
```

**关键设计决策：`createJob` 接受 `BackgroundJob`，而不是 params union。**

This means the orchestrator has zero knowledge of job-type-specific parameters. A caller builds the job:

```typescript
// In a dialog:
import { buildDownloadVideoJob } from '@/lib/downloadVideoJobFactory'

const job = buildDownloadVideoJob({
  name: 'Download Video',
  folder: downloadFolder,
  urls: [url],
  itemMeta: [{ title, artist }],
})
await createJob(job)
```

If a new job type is added, the orchestrator's `createJob` signature never changes. New callers just import the new factory and build the job the same way.

```typescript
// Adding a hypothetical 'trim-video' type:
import { buildTrimVideoJob } from '@/lib/trimVideoJobFactory'

const job = buildTrimVideoJob({ videoPath, startTime, endTime, folder })
await createJob(job)  // orchestrator.handleJob() works without any change
```

#### Reactive selectors（通过 context 暴露）

```typescript
interface JobOrchestratorState {
  /** All jobs in the store (for the StatusBar popover). */
  jobs: BackgroundJob[]

  /**
   * 响应式 hook：查询指定 folder + type 下，哪些路径有 running/pending/failed 任务。
   * type 参数为 JOB_TYPE_REGISTRY 中注册的类型。
   */
  useFileStatuses(folder: string, type: string): {
    runningPaths: Set<string>
    pendingPaths: Set<string>
    failedPaths: Set<string>
    /** 支持同一路径多任务：path -> 多个 jobId（按创建时间升序） */
    jobIdsByPath: Map<string, string[]>
    /** 快速操作入口：每个 path 当前优先操作的 jobId */
    primaryJobIdByPath: Map<string, string>
  }

  /** Aggregated indicator state for the StatusBar. */
  useJobIndicatorState(): {
    runningCount: number
    pendingCount: number
    failedCount: number
    statusVariant: 'running' | 'warning' | 'success'
    isPopoverOpen: boolean
    setPopoverOpen: (open: boolean) => void
  }
}
```

**`useFileStatuses` 实现（泛型、由 registry 驱动）：**

```typescript
function useFileStatuses(folder: string, type: string) {
  const config = JOB_TYPE_REGISTRY[type]
  const jobRecords = useJobRecords() // from orchestrator state

  return useMemo(() => {
    const runningPaths = new Set<string>()
    const pendingPaths = new Set<string>()
    const failedPaths = new Set<string>()
    const jobIdsByPath = new Map<string, string[]>()
    const primaryJobIdByPath = new Map<string, string>()

    for (const r of jobRecords) {
      if (r.type !== type || r.folder !== folder) continue
      let data: unknown
      try { data = JSON.parse(r.data || '{}') } catch { continue }
      const path = config?.extractPath(data)
      if (!path) continue

      const ids = jobIdsByPath.get(path) ?? []
      ids.push(r.id)
      jobIdsByPath.set(path, ids)
      if (r.status === 'running') runningPaths.add(path)
      else if (r.status === 'pending') pendingPaths.add(path)
      else if (r.status === 'failed') failedPaths.add(path)
    }

    // 选出每个 path 的 primary job（优先 running > pending > failed > 其他）
    for (const [path, ids] of jobIdsByPath) {
      const primary = ids.find((id) => {
        const r = jobRecords.find((j) => j.id === id)
        return r?.status === 'running'
      }) ?? ids.find((id) => {
        const r = jobRecords.find((j) => j.id === id)
        return r?.status === 'pending'
      }) ?? ids.find((id) => {
        const r = jobRecords.find((j) => j.id === id)
        return r?.status === 'failed'
      }) ?? ids[0]

      if (primary) primaryJobIdByPath.set(path, primary)
    }

    return { runningPaths, pendingPaths, failedPaths, jobIdsByPath, primaryJobIdByPath }
  }, [jobRecords, folder, type, config])
}
```

没有 per-type 分支。路径归属由 registry 的 `extractPath` 定义。  
同一路径多任务不再覆盖：UI 可展示完整队列（`jobIdsByPath`），也可用 `primaryJobIdByPath` 做“单击操作”。

---

## How consumers change

### MusicPanel

**Current:** Instantiates 5 manager hooks, each with its own SW listener, `indexed-updated` listener, and auto-start logic.

**v2:** Uses two things from the orchestrator:

```typescript
function MusicPanel() {
  const { createJob, startJob, stopJob, removeJob, useFileStatuses } = useJobOrchestrator()

  const platformFolder = mediaMetadata?.mediaFolderPath
    ? Path.toPlatformPath(mediaMetadata.mediaFolderPath)
    : undefined

  // Reactive status for each job type — replace 5 separate manager hooks
  const downloadStatus  = useFileStatuses(platformFolder, 'download-video')
  const transcribeStatus = useFileStatuses(platformFolder, 'transcribe')
  const translateStatus  = useFileStatuses(platformFolder, 'translate')
  const synthesizeStatus = useFileStatuses(platformFolder, 'synthesize')
  const processStatus    = useFileStatuses(platformFolder, 'process')

  // To create jobs (caller builds with factory):
  const handleDownload = async () => {
    const job = buildDownloadVideoJob({ name, folder, urls, itemMeta })
    await createJob(job)
  }

  // 手动启动：默认不抢占；必要时可 forceStart
  const handleStart = async (jobId: string, forceStart = false) => {
    const result = await startJob(jobId, { forceStart })
    if (!result.started && result.reason === 'concurrency-blocked') {
      // 可提示：当前同类型任务正在执行，已进入调度队列
    }
  }

  // To stop/remove:
  const handleStop = (jobId: string) => stopJob(jobId)
  const handleRemove = (jobId: string) => removeJob(jobId)

  // ... render table using downloadStatus.runningPaths,
  //     transcribeStatus.jobIdsByPath / primaryJobIdByPath, etc.
}
```

No SW listeners. No `indexed-updated` handlers. No `useJobManager` instances. MusicPanel is a pure consumer.

### DownloadVideoDialog

**Current:** Calls `saveDownloadVideoJob` → dispatches `indexed-updated` → hopes MusicPanel's `useJobManager` catches it.

**v2:** Calls `createJob` from context:

```typescript
const { createJob, createJobs } = useJobOrchestrator()

const handleStart = async () => {
  const jobs = urls.map(u => {
    const episode = episodes.find(e => e.url === u)
    return buildDownloadVideoJob({
      name: episode?.title || 'Download Video',
      folder: downloadFolder,
      urls: [u],
      itemMeta: episode ? [{ title: episode.title, artist: episode.artist }] : undefined,
    })
  })

  const result = await createJobs(jobs)
  if (result.failures.length > 0) {
    // 按需提示部分失败并提供重试
  }
  onClose() // jobs will auto-start regardless of active panel
}
```

The orchestrator persists and auto-starts — no dependency on MusicPanel.

### Menu

**Current:** Calls `openDownloadVideo()` — just opens the dialog. The bug is downstream.

**v2:** No change to Menu. It only opens dialogs. The dialogs use `createJob`, which works everywhere.

### MCP / external tools

**v2:** The orchestrator exposes a global handle for non-React consumers:

```typescript
// In JobOrchestratorProvider, on mount:
window.__jobOrchestrator = {
  createJob,
  createJobs,
  startJob, // startJob(id, { forceStart?: boolean })
  stopJob,
  removeJob,
  isReady: () => swReady,
}
```

MCP tools can call `window.__jobOrchestrator.createJob(job)` directly. The job object can be built from any factory — the orchestrator doesn't care about the type.

---

## Concurrency model

```
                    ┌──────────────────────────────┐
                    │      JobOrchestrator          │
                    │                               │
                    │  runningSet:                   │
                    │    "C:/Music"  → { download }  │
                    │    "D:/Videos" → { transcribe } │
                    │    "E:/Shows"  → { process }    │
                    │    "D:/Videos" → { download }    │  ← OK: different type, same folder
                    │                               │
                    │  Rules:                        │
                    │   • Max 1 running job per      │
                    │     (type, folder) pair        │
                    │   • Different types can run    │
                    │     concurrently in the same   │
                    │     folder                     │
                    │   • Different folders are      │
                    │     fully independent          │
                    │   • Unknown types (not in      │
                    │     registry) are persisted    │
                    │     but never auto-started     │
                    └──────────────────────────────┘
```

When a job finishes, the orchestrator checks the pending queue for the same (type, folder) and auto-starts the next one.

### `startJob` 与 auto-start 开关关系（新增约束）

- `startJob(id, { forceStart: false })`
  - 不绕过并发保护；
  - 若同 `(type, folder)` 已有 running，返回 `concurrency-blocked`；
  - 此时任务仍由调度器负责后续自动启动。
- `startJob(id, { forceStart: true })`
  - 强制启动，绕过 auto-start 开关；
  - 即使已有同 `(type, folder)` 的 running 任务也允许启动。
- 设计原则：默认保持调度稳定，只有用户显式操作才允许“强制并行/抢占”。

---

## What adding a new job type looks like

Say you want to add `trim-video` — a job that trims a video to a time range.

### Step 1: Create the factory (`lib/trimVideoJobFactory.ts`)

```typescript
export function buildTrimVideoJob(input: {
  folder: string
  videoPath: string
  title: string
  startTime: number
  endTime: number
}): BackgroundJob {
  // ... build and return a BackgroundJob with type: 'trim-video'
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

### Step 3: Add SW handler (`download-service-worker.js`)

```javascript
async function startTrimVideo(jobId) { /* POST /api/trim */ }

// In the message handler:
case 'trim-video:start':  startTrimVideo(msg.id); break
case 'trim-video:stop':   stopTrimVideo(msg.id); break
case 'trim-video:remove': removeTrimVideo(msg.id); break
```

### Step 4: Build the UI dialog

Import `useJobOrchestrator`, call `createJob(buildTrimVideoJob(...))`.

### Files NOT touched

- `JobOrchestratorProvider.tsx`
- `stores/backgroundJobsStore.ts`
- `lib/downloadTaskDb.ts`
- `hooks/useJobOrchestrator.ts`
- `components/MusicPanel.tsx`
- `components/StatusBar.tsx`
- The SW's heartbeat, message routing, or lifecycle logic (only the type-specific handler)

---

## Per-type file responsibilities

| Concern | Where it lives | Changes with new type? |
|---|---|---|
| Job data structure | `types/background-jobs.ts` | Add new interface (extends `BackgroundJob`) |
| Job construction | `lib/<name>JobFactory.ts` | New file |
| Type metadata | `lib/jobTypeRegistry.ts` | One new entry |
| Execution | `public/download-service-worker.js` | New start/stop/remove handler |
| UI | `<Something>Dialog.tsx` | New dialog |
| **Everything else** | — | **Zero changes** |

---

## Migration strategy

The migration is incremental. Each step is independently testable.

### Phase 1: Create `jobTypeRegistry.ts` and `JobOrchestratorProvider`

- Extract current type metadata into the registry
- Create the orchestrator at app root, mounted alongside `DialogProvider`
- Owns the Zustand store sync and SW message bridge
- Exposes context (`createJob`, `createJobs`, `startJob(id, options)`, `stopJob`, `removeJob`, `useFileStatuses`)
- 引入单调度器开关：默认仅保留一个“可执行调度器”（建议先关闭旧 managers 的 auto-start，仅保留状态读取）
- **目标是零重复调度**：避免新旧调度器并行导致同任务重复启动

### Phase 2: Migrate job creators

- `DownloadVideoDialog`: replace `saveDownloadVideoJob` → `createJob(buildDownloadVideoJob(...))`
- `TranscribeDialog`: replace direct IDB save → `createJob(buildTranscribeJob(...))`
- `SubtitleTranslationDialog`: same pattern
- `SynthesizeSubtitleDialog`: same pattern
- `ProcessPipelineDialog`: same pattern
- `createJobs` 明确采用**非事务语义**（允许部分成功），调用方按返回的 `failures` 重试失败项
- **The menu download bug is fixed in this phase**

### Phase 3: Migrate MusicPanel consumers

- Replace `useDownloadManager` → `useFileStatuses(folder, 'download-video')`
- Replace `useTranscribeManager` → `useFileStatuses(folder, 'transcribe')`
- Same for translate, synthesize, process
- Start/stop/remove: use `startJob(id, options)` / `stopJob` / `removeJob` from context directly
- 使用 `jobIdsByPath` 支持同一路径多任务；`primaryJobIdByPath` 仅用于快捷操作

### Phase 4: Remove old code

- Delete `useJobManager.ts`
- Delete `useDownloadManager.ts`, `useTranscribeManager.ts`, `useTranslateManager.ts`, `useSynthesizeManager.ts`, `useProcessManager.ts`
- Delete `IndexedDbObserver.tsx` (superseded)
- Delete `components/eventlisteners/MediaLibraryImportedEventHandler.tsx` (logic merged into orchestrator)
- Keep `FixedDelayBackgroundJobHandler.tsx` as-is (testing utility)

---

## File changes summary

| File | Action |
|---|---|
| `src/lib/jobTypeRegistry.ts` | **New** — extensible registry of all job types |
| `src/components/JobOrchestratorProvider.tsx` | **New** — app-level orchestrator, type-agnostic |
| `src/hooks/useJobOrchestrator.ts` | **New** — context consumption hook |
| `src/types/background-jobs.ts` | Keep, add `BackgroundJobBase` refinements (no union changes needed) |
| `src/stores/backgroundJobsStore.ts` | Keep (Zustand store) |
| `src/lib/downloadTaskDb.ts` | Keep (IndexedDB layer), no schema changes |
| `public/download-service-worker.js` | Keep, add one handler per new type |
| `src/lib/*JobFactory.ts` (5 files) | Keep, used by callers before passing to orchestrator |
| `src/hooks/useJobManager.ts` | **Remove** (phase 4) |
| `src/hooks/useDownloadManager.ts` | **Remove** (phase 4) |
| `src/hooks/useTranscribeManager.ts` | **Remove** (phase 4) |
| `src/hooks/useTranslateManager.ts` | **Remove** (phase 4) |
| `src/hooks/useSynthesizeManager.ts` | **Remove** (phase 4) |
| `src/hooks/useProcessManager.ts` | **Remove** (phase 4) |
| `src/components/IndexedDbObserver.tsx` | **Remove** (phase 4) |
| `src/components/eventlisteners/MediaLibraryImportedEventHandler.tsx` | **Remove** (phase 4) |
| `src/components/MusicPanel.tsx` | Simplify — replace 5 hooks with `useFileStatuses` |
| `src/components/dialogs/download-video-dialog.tsx` | Replace `saveDownloadVideoJob` with `createJob(buildDownloadVideoJob(...))` |
| `src/components/dialogs/TranscribeDialog.tsx` | Replace direct IDB save with `createJob(buildTranscribeJob(...))` |
| `src/components/dialogs/SubtitleTranslationDialog.tsx` | Same pattern |
| `src/components/dialogs/SynthesizeSubtitleDialog.tsx` | Same pattern |
| `src/components/dialogs/ProcessPipelineDialog.tsx` | Same pattern |
| `src/providers/dialog-provider.tsx` | No changes needed |
| `src/AppV2.tsx` | Add `<JobOrchestratorProvider>` wrapper |

---

## Non-goals

- **Changing the Service Worker's overall structure.** The SW still has per-type handlers — that's inherent to different API endpoints. But the new design reduces what changes when a type is added: add the handler function, wire it to the message switch, done.
- **Changing the IndexedDB schema.** The existing `DownloadTaskDatabase` / `jobs` store handles arbitrary types already.
- **Real-time progress updates for non-download jobs.** The SW heartbeat mechanism already covers this for all types.
- **Job persistence beyond 1 hour.** The `isWithinOneHour` filter is preserved.
