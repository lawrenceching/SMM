# Background Jobs

SMM 的后台任务系统，用于跟踪和管理长时间运行的异步操作（下载、转写、翻译、合成、处理等）。

## 1. Architecture Overview

`JobOrchestratorProvider` 是 app 级别的单例 orchestrator，挂载在 `main.tsx`，始终存活。

```
main.tsx → <JobOrchestratorProvider>
  ├── IndexedDB ↔ Zustand sync (TaskJobRecord → BackgroundJob)
  ├── Auto-start queue — one running job per (type, folder)
  ├── Job lifecycle: pending → running → succeeded/failed/aborted
  ├── parentId batch cancellation on failure
  └── Exposes: createJob, startJob, stopJob, removeJob
```

> **架构演进**: v1 与 MusicPanel 生命周期耦合；v2 集中到 app-level provider。Service Worker 原先代理 CLI 命令执行，后移除（见下），现在由主线程直接执行。

## 2. Service Worker Removal

SW 在 Electron SPA 架构中不是必需的。移除后减少约 1200 行代码重复，简化双向通信，全链路 TypeScript 类型安全。

**Before**: `UI Thread → postMessage → Service Worker → fetch → CLI Backend + IDB`  
**After**: `UI Thread → backgroundJobRunner (in-process) → fetch → CLI Backend + IDB`

执行逻辑内聚在 `JobOrchestratorProvider` 中，不再通过 postMessage。页面刷新后通过 reconciliation poller 从 CLI 查询命令状态恢复。

## 3. Core Components

### 3.1 `JobTypeRegistry` — 单一扩展点

`src/lib/jobTypeRegistry.ts` — 每种 job type 只需在此注册一条：

```typescript
export interface JobTypeConfig {
  messagePrefix: string
  autoStartKey: string
  extractPath: (data: unknown) => string
  toasts?: {
    started?: (t: TFunction) => string
    succeeded?: (t: TFunction) => string
    failed?: (t: TFunction) => string
  }
}
```

### 3.2 `JobOrchestratorProvider`

**Lifecycle**: mount → eager-load IDB → sync → tryAutoStartAll → reactive to IDB events.

**Concurrency**: max 1 running job per `(type, folder)` pair. Different types can run concurrently.

**Batch cancellation**: jobs with same `parentId` — if one fails, all pending siblings auto-cancelled.

### 3.3 `useJobManager`

Unified facade hook: `createJob`, `createJobs`, `startJob`, `stopJob`, `removeJob`, `stopAllJobs`.

### 3.4 `downloadTaskDb` — IndexedDB

`TaskJobRecord` schema: `{ id, name, status, progress, type, folder, data?, parentId?, createdAt, updatedAt }`.

Auto-start window: jobs created within 1 hour. Popover window: 24 hours, max 100 records.

## 4. Job Types

| Type | Execution | Timeout | Registry `extractPath` |
|------|-----------|---------|------------------------|
| `download-video` | yt-dlp via executeCmd | 1h | `data.videos[0].url` |
| `transcribe` | videocaptioner | 10min | `data.mediaPath` |
| `translate` | videocaptioner | 10min | `data.mediaPath` |
| `synthesize` | videocaptioner | 1h | `data.mediaPath` |
| `process` | videocaptioner (full pipeline) | 2h | `data.mediaPath` |
| `ffmpeg-convert` | ffmpeg via executeCmd | — | — |
| `generic` | in-memory only | — | — |
| `test-delay` | in-process setTimeout | — | — |

### Adding a New Job Type

4 steps: ① create factory ② add registry entry ③ no SW handler needed (main thread) ④ build UI. No changes to orchestrator, store, or IDB layer.

## 5. Progress Display: Command Log Polling

yt-dlp/ffmpeg 实时进度通过 **Command Log 轮询** 获取，而非 `onProgress` callback 写 store。

```
CLI command log (main.log) ← 单一日志源
  ↑ TanStack Query (200ms poll)
useCommandLogQuery(executionId, isRunning)
  ↑
useYtdlpDownloadProgressQuery / useFfmpegProgressQuery
  ├── BackgroundJobItem (BackgroundJobsPopover)
  └── JobTableRow (MusicPanel)
```

关键设计：实时 transient 字段（progress/speed/ETA）**不持久化**到 IDB，避免 IDB poll 覆盖 in-memory 状态。

## 6. Stop All

右键任意后台任务 → "Stop All"：先标记所有 pending → aborted，再停止 running 任务。这个顺序确保 orchestrator 的 auto-chain `finally` 找不到 pending siblings 来启动。

## 7. Error Handling: Toast Notifications

| Job Type | Failure Toast | "日志" Button |
|----------|:------------:|:------------:|
| download-video | ✅ | ✅ (has executionId) |
| transcribe | ✅ | ✅ |
| translate | ✅ | ✅ |
| synthesize | ✅ | ✅ |
| process | ✅ | ✅ |
| ffmpeg-convert | ✅ | ✅ |
| test-delay | ✅ | ❌ |
| generic fallback | ✅ | ❌ |

Toasts 在 `JOB_TYPE_REGISTRY[type].toasts` 中配置；未配置的 type 使用 generic fallback。有 `executionId` 的 job 失败 toast 附加 "日志" action button → 打开 LogDialog。

## 8. Key Files

| File | Role |
|------|------|
| `src/types/background-jobs.ts` | Type definitions |
| `src/stores/backgroundJobsStore.ts` | Zustand store |
| `src/lib/downloadTaskDb.ts` | IndexedDB persistence |
| `src/lib/jobTypeRegistry.ts` | Type metadata (single extension point) |
| `src/components/JobOrchestratorProvider.tsx` | App-level orchestrator |
| `src/hooks/useJobManager.ts` | Unified facade hook |
| `src/components/background-jobs/` | StatusBar popover UI |
