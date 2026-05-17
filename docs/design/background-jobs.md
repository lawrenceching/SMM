# Background Jobs

The UI tracks long-running async operations as typed **background jobs** with a shared lifecycle (pending → running → succeeded/failed/aborted). A Zustand store holds the in-memory state, IndexedDB provides persistence, and a Service Worker executes the actual work for jobs that hit backend APIs.

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    React UI                              │
│  ┌──────────────┐  ┌──────────────────┐  ┌───────────┐  │
│  │ Job Factories │  │  backgroundJobs   │  │  StatusBar │  │
│  │ (lib/*.ts)    │──▶  Store (Zustand)  │──▶  Indicator │  │
│  └──────────────┘  └────────┬─────────┘  └───────────┘  │
│                             │                            │
│                    ┌────────▼─────────┐                  │
│                    │  IndexedDbObserver │                 │
│                    │  (SW ↔ Store sync) │                 │
│                    └────────┬─────────┘                  │
└─────────────────────────────┼────────────────────────────┘
                              │ postMessage
┌─────────────────────────────▼────────────────────────────┐
│              Service Worker (download-service-worker.js)   │
│  startDownload / startTranscribe / startTranslate /       │
│  startSynthesize / startProcess                            │
│  (makes fetch() calls to backend APIs)                    │
└──────────────────────────────────────────────────────────┘
```

### Persistence

Job records are persisted in IndexedDB (`DownloadTaskDatabase` / `jobs` store) via `lib/downloadTaskDb.ts`. The `IndexedDbObserver` component syncs SW-side changes back to the Zustand store on startup and on each SW message.

### Service Worker lifecycle

On SW activate, any jobs left in `running` state are reset to `stopped` (download videos reset from `downloading` to `pending`). On app startup, running jobs from the last hour are marked `aborted`.

---

## Job types

### 1. `generic`

Fallback type for simple named jobs without structured data. Created by calling `addJob("Some name")`.

- **Types file**: `GenericBackgroundJob` (type: `'generic'`)
- **Data**: `Record<string, never>` (empty)
- **Factory**: None (created inline in store)
- **Runner**: In-process (no SW dispatch)
- **Persistence**: Not persisted
- **Execution**: Runs inline in the main thread
- **Example usage**: `backgroundJobs.addJob("Importing Media Library")` in `MediaLibraryImportedEventHandler`

### 2. `download-video`

Download media files (e.g., Bilibili videos) via the yt-dlp backend. Tracks each video in a multi-video batch.

- **Types file**: `DownloadVideoBackgroundJob` (type: `'download-video'`)
- **Data**: `{ folder, videos: [{ url, artist, title, status }] }`
- **Factory**: `lib/downloadVideoJobFactory.ts` — `buildDownloadVideoJob()`
- **Persistence**: `lib/downloadTaskDb.ts` — `saveDownloadVideoJob()`
- **Runner**: Service Worker (`startDownload`), calls `POST /api/ytdlp/download`
- **Sub-status**: Per-video items progress through `pending → downloading → succeeded | failed`
- **Heartbeat**: `download:heartbeat` every 20s
- **Progress**: Derived from ratio of completed videos (`recomputeDownloadVideoJobProgress`)
- **SW messages**: `download:start`, `download:stop`, `download:resume`, `download:remove`
- **SW events**: `download:started`, `download:succeeded`, `download:failed`, `download:stopped`, `download:removed`
- **Per-video status**: `DownloadVideoItemStatus` — `'pending' | 'downloading' | 'succeeded' | 'failed'`

### 3. `transcribe`

Speech-to-text transcription of a media file. Supports two providers: VideoCaptioner CLI and Tencent ASR.

- **Types file**: `TranscribeBackgroundJob` (type: `'transcribe'`)
- **Data**: `{ folder, mediaPath, title, provider, videoCaptioner?, tencentAsr?, executionId?, logRelativePath? }`
- **Factory**: `lib/transcribeJobFactory.ts` — `buildTranscribeJob()`
- **Persistence**: `lib/downloadTaskDb.ts` — `saveTranscribeJob()`
- **Runner**: Service Worker (`startTranscribe`)
  - VideoCaptioner: `POST /api/videocaptioner/transcribe` with ASR engine config
  - Tencent ASR: `POST /api/tencent-asr/transcribe`
- **Providers**: `'videoCaptioner' | 'tencentAsr'`
- **ASR engines** (VideoCaptioner): `'bijian' | 'jianying' | 'whisper-cpp'`
- **Output formats**: `'srt' | 'ass' | 'txt' | 'json'`
- **Heartbeat**: `transcribe:heartbeat` every 20s
- **SW messages**: `transcribe:start`, `transcribe:stop`, `transcribe:remove`
- **SW events**: `transcribe:started`, `transcribe:succeeded`, `transcribe:failed`, `transcribe:stopped`, `transcribe:removed`

### 4. `translate`

Translate an existing subtitle file into a target language via VideoCaptioner.

- **Types file**: `TranslateBackgroundJob` (type: `'translate'`)
- **Data**: `{ folder, subtitlePath, title, translator, targetLanguage, mediaPath?, reflect?, layout?, llm?, executionId?, logRelativePath? }`
- **Factory**: `lib/translateJobFactory.ts` — `buildTranslateJob()`
- **Persistence**: `lib/downloadTaskDb.ts` — `saveTranslateJob()`
- **Runner**: Service Worker (`startTranslate`), calls `POST /api/videocaptioner/translate`
- **Translators**: `'bing' | 'google' | 'llm'`
- **Subtitle layouts**: `'target-above' | 'source-above' | 'target-only' | 'source-only'`
- **Heartbeat**: `translate:heartbeat` every 20s
- **SW messages**: `translate:start`, `translate:stop`, `translate:remove`
- **SW events**: `translate:started`, `translate:succeeded`, `translate:failed`, `translate:stopped`, `translate:removed`

### 5. `synthesize`

Burn subtitles into a video file (soft or hard subs) via VideoCaptioner.

- **Types file**: `SynthesizeBackgroundJob` (type: `'synthesize'`)
- **Data**: `{ folder, videoPath, subtitlePath, title, subtitleMode?, quality?, style?, renderMode?, layout?, executionId?, logRelativePath? }`
- **Factory**: `lib/synthesizeJobFactory.ts` — `buildSynthesizeJob()`
- **Persistence**: `lib/downloadTaskDb.ts` — `saveSynthesizeJob()`
- **Runner**: Service Worker (`startSynthesize`), calls `POST /api/videocaptioner/synthesize`
- **Subtitle modes**: `'soft' | 'hard'`
- **Quality levels**: `'ultra' | 'high' | 'medium' | 'low'`
- **Render modes**: `'ass' | 'rounded'`
- **Subtitle layouts**: `'target-above' | 'source-above' | 'target-only' | 'source-only'`
- **Heartbeat**: `synthesize:heartbeat` every 20s
- **SW messages**: `synthesize:start`, `synthesize:stop`, `synthesize:remove`
- **SW events**: `synthesize:started`, `synthesize:succeeded`, `synthesize:failed`, `synthesize:stopped`, `synthesize:removed`

### 6. `process`

Full VideoCaptioner pipeline: transcribe → translate → synthesize in a single API call.

- **Types file**: `ProcessBackgroundJob` (type: `'process'`)
- **Data**: Includes all transcribe + translate + synthesize options plus pipeline control flags (`noOptimize`, `noTranslate`, `noSplit`, `noSynthesize`)
- **Factory**: `lib/processJobFactory.ts` — `buildProcessJob()`
- **Persistence**: `lib/downloadTaskDb.ts` — `saveProcessJob()`
- **Runner**: Service Worker (`startProcess`), calls `POST /api/videocaptioner/process`
- **Heartbeat**: `process:heartbeat` every 20s
- **SW messages**: `process:start`, `process:stop`, `process:remove`
- **SW events**: `process:started`, `process:succeeded`, `process:failed`, `process:stopped`, `process:removed`

### 7. Media Library Import (pseudo-job via `generic`)

Triggered by a DOM custom event (`UI_MediaLibraryImportedEvent`). Scans a media library path, discovers sub-folders, persists folders to user config, and initializes each folder.

- **Handler**: `components/eventlisteners/MediaLibraryImportedEventHandler.tsx`
- **Job type**: Uses `generic` via `addJob("Importing Media Library")`
- **Execution**: In-process, serial folder-by-folder initialization
- **Progress**: Steps through folders at `100 / folderCount` per folder

### 8. Fixed Delay Job (testing/utility)

Simulates a job with a configurable delay. Triggered by a DOM custom event (`UI_FixedDelayBackgroundJobEvent`).

- **Handler**: `components/eventlisteners/FixedDelayBackgroundJobHandler.tsx`
- **Job name**: `"<name> (\`<delay>\`ms)"` or `"延迟任务 (\`<delay>\`ms)"`
- **Execution**: In-process via `setTimeout` with animated progress (0% → 90% over delay, then 100%)
- **Purpose**: Testing/tooling — not used in production flows

### 9. `recognizeEpisodes` Web Worker (not a background job)

A dedicated Web Worker (`lib/recognizeEpisodes.worker.ts`) that runs episode number recognition from media metadata. This is **not** tracked in the background jobs store — it's a separate worker for CPU-bound computation that returns results via `postMessage`.

- **Type**: Standard Web Worker (no SW involvement)
- **Purpose**: Parse media filenames/metadata to identify episode numbers
- **Communication**: `postMessage` / `onmessage` with `{ type: 'recognize', id, payload }`

---

## Job lifecycle

```
         ┌──────────┐
         │  pending  │
         └─────┬─────┘
               │ start
         ┌─────▼──────┐
         │   running   │
         └──┬──────┬───┘
            │      │
     ┌──────▼─┐ ┌──▼───────┐
     │succeeded│ │  failed   │
     └────────┘ └──────────┘
            ▲
            │ abort (only from running)
       ┌────┴────┐
       │ aborted  │
       └─────────┘
```

All jobs start as `pending`, transition to `running` when started, and end as `succeeded`, `failed`, or `aborted` (user-initiated cancel). Service Worker jobs also support a `stopped` state (distinct from `aborted`, used when the SW itself stops mid-job).

---

## Key files

| File | Role |
|---|---|
| `src/types/background-jobs.ts` | Type definitions, type guards |
| `src/stores/backgroundJobsStore.ts` | Zustand store (add, update, abort, remove) |
| `src/lib/downloadTaskDb.ts` | IndexedDB persistence layer |
| `src/lib/downloadVideoJobFactory.ts` | Download-video job builder |
| `src/lib/transcribeJobFactory.ts` | Transcribe job builder |
| `src/lib/translateJobFactory.ts` | Translate job builder |
| `src/lib/synthesizeJobFactory.ts` | Synthesize job builder |
| `src/lib/processJobFactory.ts` | Process (full pipeline) job builder |
| `src/lib/recognizeEpisodes.worker.ts` | Episode recognition web worker |
| `public/download-service-worker.js` | Service Worker (executes all download/transcribe/translate/synthesize/process jobs) |
| `src/components/IndexedDbObserver.tsx` | SW ↔ React store sync bridge |
| `src/components/background-jobs/BackgroundJobsProvider.tsx` | React context provider |
| `src/components/background-jobs/BackgroundJobsPopover.tsx` | Status bar popover (trigger + shell) |
| `src/components/background-jobs/BackgroundJobsPopoverContent.tsx` | Popover body (header + list) |
| `src/components/background-jobs/BackgroundJobsPopoverHeader.tsx` | Title, subtitle, clear button |
| `src/components/background-jobs/BackgroundJobsPopoverList.tsx` | Job rows (loading / empty / list) |
| `src/components/hooks/useBackgroundJobsIndicator.ts` | Indicator state hook |
| `src/components/eventlisteners/MediaLibraryImportedEventHandler.tsx` | Media library import handler |
| `src/components/eventlisteners/FixedDelayBackgroundJobHandler.tsx` | Fixed-delay test job handler |
