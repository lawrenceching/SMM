# yt-dlp Download Progress & Speed Display

Show real-time download progress (percentage, speed, ETA) in BackgroundJobsPopover
for `download-video` jobs during yt-dlp execution.

## 1. Background

Currently, yt-dlp download jobs report only coarse progress:
- `progress = 0` when the job starts, `progress = 100` when all videos complete
- No real-time per-video percentage or speed information

The CLI spawns yt-dlp via `executeCmd` and streams NDJSON (`stdout` / `stderr` / `system`).
yt-dlp itself can output structured progress via `--newline` + `--progress-template` (see
`yt-dlp-progress.md` reference). By adding these args and parsing the resulting JSON lines,
we can get per-video download percentage, speed (bytes/sec), and ETA (seconds).

**Goal**: Display real-time download progress and speed in BackgroundJobsPopover.

## 2. Architecture Overview

```
┌──────────────────────────────────────────────────────────────────────────┐
│ apps/cli → executeCmd.ts                                                  │
│                                                                           │
│ When command == 'yt-dlp':                                                 │
│   spawnArgs.push('--newline', '--progress-template', '...')              │
│                                                                           │
│ In child.stdout handler:                                                  │
│   if line is progress JSON → emit NDJSON { type: "progress", data: {...}}│
│   else → emit NDJSON { type: "stdout", data: line }                     │
└──────────────────────────────────────────┬───────────────────────────────┘
                                           │ NDJSON stream (new "progress" type)
                                           ▼
┌──────────────────────────────────────────────────────────────────────────┐
│ apps/ui → executeCmdToCompletionWithHeaders                               │
│                                                                           │
│ New option: onProgress?: (data: YtdlpProgressData) => void               │
│ Parsed from { type: "progress", data: {...} } NDJSON messages             │
└──────────────────────────────────────────┬───────────────────────────────┘
                                           │ onProgress callback
                                           ▼
┌──────────────────────────────────────────────────────────────────────────┐
│ apps/ui → JobOrchestratorProvider.executeJob (download-video case)        │
│                                                                           │
│ onProgress →                                                              │
│   1. Update Zustand store directly (real-time UI)                        │
│      useBackgroundJobsStore.getState().patchJob(id, ...)                 │
│   2. Update local record ref (for eventual IDB persistence)              │
│   3. Debounced (~3s) IDB putJob() for crash recovery                     │
│                                                                           │
│ Overall job.progress =                                                    │
│   (completedVideos * 100 + currentVideoProgressPercent) / totalVideos    │
└──────────────────────────────────────────┬───────────────────────────────┘
                                           │ Zustand store update
                                           ▼
┌──────────────────────────────────────────────────────────────────────────┐
│ apps/ui → BackgroundJobsPopoverList                                       │
│                                                                           │
│ For running download-video jobs:                                         │
│   Progress bar: job.progress                                              │
│   Percentage text: Math.round(job.progress)%                             │
│   Speed text: formatSpeed(job.data.downloadSpeedBps)  → "2.5 MB/s"      │
│   ETA text: formatEta(job.data.downloadEtaSeconds)     → "1m 23s"       │
└──────────────────────────────────────────────────────────────────────────┘
```

## 3. Detailed Design

### 3.1 CLI: Add progress args and parsing

**File:** `apps/cli/src/route/executeCmd.ts`

When the command is `yt-dlp`, append these args to the spawn (manually verified against YouTube 401+251), and set the env var `PYTHONUNBUFFERED=1`:

```
--newline
--progress-template {"percent": "%(progress._percent_json)s", "speed": "%(progress.speed)r", "eta": %(progress.eta)r, "downloaded": %(progress.downloaded_bytes)r, "total": %(progress.total_bytes)r, "status": "%(progress.status)s"}
```

**Why `PYTHONUNBUFFERED=1` is required**: yt-dlp is a Python application. Python's stdout is line-buffered when connected to a TTY (terminal), but block-buffered (typically 8KB) when connected to a pipe. SMM spawns yt-dlp with `child_process.spawn({ stdio: 'pipe' })`, so Python block-buffers its output. Without unbuffered mode, progress lines never flush in time — they sit in yt-dlp's internal buffer until the buffer fills or the process exits. The diagnostic showed that for a 56-second download, SMM received `total_bytes=0` until the very end, when only the final `--print after_move:filepath` output (198 bytes) flushed. Setting `PYTHONUNBUFFERED=1` forces Python to flush after every `\n`, restoring the real-time behavior the user sees when running yt-dlp directly in a terminal.

```
--newline
--progress-template {"percent": "%(progress._percent_json)s", "speed": "%(progress.speed)r", "eta": %(progress.eta)r, "downloaded": %(progress.downloaded_bytes)r, "total": %(progress.total_bytes)r, "status": "%(progress.status)s"}
```

**Critical**: `percent` and `speed` are wrapped in double quotes so yt-dlp emits them as JSON strings. This means when the value is unavailable, yt-dlp outputs `"NA"` (valid JSON string) instead of `NA` (invalid JSON).

In the child process stdout handler, for each line:
1. Sanitize: replace unquoted `: NA` with `: null` via regex (leaves quoted `"NA"` alone).
2. Parse the sanitized line as JSON.
3. If the parsed object has a `status` field of `'downloading'` or `'finished'` → emit `progress` NDJSON.
4. Otherwise → emit `stdout` NDJSON as before.

Field value normalization (`parseProgressNumericValue`):
- `number` (e.g. `42.5`) → use directly
- `string` `"NA"` → `null` (skip)
- `string` `"42.5"` → `Number("42.5")` (parse)
- `string` `""` → `null`
- any other type → `null`

**Percent fallback**: when `percent` is null but `downloaded` and `total` are valid numbers, compute `percent = (downloaded / total) * 100`. This rescues the UI for resume / live-stream scenarios where yt-dlp can't compute `_percent_json`.

New NDJSON message type:
```typescript
interface NdjsonProgressMessage {
  type: 'progress';
  data: {
    percent: number;        // 0-100, e.g. 42.3 (or computed from downloaded/total)
    speed: number;          // bytes per second, e.g. 1234567
    eta: number | null;     // seconds remaining, null if unknown
    downloaded: number | null; // bytes downloaded, null if unknown
    total: number | null;   // total bytes, null if unknown
    status: 'downloading' | 'finished';
  };
}
```

Progress lines where `status === 'finished'` can be ignored (we'll detect completion via exit code).

**Shell escaping**: Since we're passing args to `spawn()` directly (no shell), no special escaping
is needed beyond proper argument array construction.

### 3.2 UI: NDJSON message types

**File:** `apps/ui/src/api/executeCmd.ts`

Add new types:
```typescript
export interface ExecuteCmdProgressMessage {
  type: 'progress';
  data: {
    percent: number;
    speed: number;
    eta: number | null;
    downloaded: number | null;
    total: number | null;
    status: 'downloading' | 'finished';
  };
}

export type ExecuteCmdMessage =
  | ExecuteCmdStdoutStderrMessage
  | ExecuteCmdSystemMessage
  | ExecuteCmdProgressMessage;
```

Update `executeCmdStream` to handle `progress` messages (forward to callbacks).

### 3.3 UI: executeCmdToCompletion callbacks

**File:** `apps/ui/src/lib/whitelistedCmd/executeCmdToCompletion.ts`

Add `onProgress` option to both `executeCmdToCompletion` and `executeCmdToCompletionWithHeaders`:
```typescript
export interface YtdlpProgressData {
  percent: number;
  speedBps: number;
  etaSeconds: number | null;
  downloadedBytes: number | null;
  totalBytes: number | null;
}

// In ExecuteCmdCompletionResult options:
onProgress?: (data: YtdlpProgressData) => void;
```

### 3.4 UI: Job type extensions

**File:** `apps/ui/src/types/background-jobs.ts`

Add to `DownloadVideoBackgroundJobData`:
```typescript
export interface DownloadVideoBackgroundJobData {
  // ... existing fields
  /** Current per-video download progress percentage (0-100). Not persisted long-term. */
  activeVideoProgress?: number;
  /** Current download speed in bytes per second. */
  downloadSpeedBps?: number;
  /** Estimated seconds remaining for current video. */
  downloadEtaSeconds?: number;
}
```

### 3.5 UI: JobOrchestratorProvider — real-time progress

**File:** `apps/ui/src/components/JobOrchestratorProvider.tsx`

In the `download-video` case of `executeJob`, modify the per-video loop:

```typescript
case 'download-video': {
  const downloadData = data as unknown as DownloadVideoBackgroundJobData;
  const videos = downloadData.videos ?? [];
  const totalVideos = videos.length;
  let completedVideos = 0;
  
  for (let i = 0; i < videos.length; i++) {
    // ... existing abort check ...
    const video = videos[i];
    
    // Track per-video progress via ref (updated by onProgress callback)
    let currentVideoProgress = 0;
    
    const result = await executeCmdToCompletionWithHeaders(
      { command: 'yt-dlp', args },
      {
        timeoutMs: JOB_TIMEOUT_MS['download-video'],
        signal: controller.signal,
        executionId,
        onProgress: (p) => {
          currentVideoProgress = p.percent;
          
          // Calculate overall job progress
          const overallProgress = 
            (completedVideos * 100 + currentVideoProgress) / totalVideos;
          
          // Update Zustand store for real-time UI
          useBackgroundJobsStore.getState().patchJob(jobId, (job) => {
            if (job.type !== 'download-video') return job;
            return {
              ...job,
              progress: Math.min(overallProgress, 99.9),
              data: {
                ...job.data,
                activeVideoProgress: p.percent,
                downloadSpeedBps: p.speedBps,
                downloadEtaSeconds: p.etaSeconds ?? undefined,
              },
            };
          });
          
          // Also update local record ref for eventual IDB sync
          record.progress = Math.min(overallProgress, 99.9);
          const d = data as DownloadVideoBackgroundJobData;
          d.activeVideoProgress = p.percent;
          d.downloadSpeedBps = p.speedBps;
          d.downloadEtaSeconds = p.etaSeconds ?? undefined;
        },
      },
    );
    
    completedVideos++;
    // ... existing success/failure handling ...
    
    // After each video, sync to IDB
    record.data = JSON.stringify(data);
    record.progress = (completedVideos / totalVideos) * 100;
    record.updatedAt = Date.now();
    await putJob(record);
    await syncFromIndexedDB('executeJob:video-completed');
  }
  
  // Final state
  record.progress = allSucceeded ? 100 : (completedVideos / totalVideos) * 100;
  // ... existing code ...
}
```

### 3.6 UI: BackgroundJobsPopoverList — speed/ETA display

**File:** `apps/ui/src/components/background-jobs/BackgroundJobsPopoverList.tsx`

For running `download-video` jobs, display speed and ETA below the progress bar:

```tsx
{job.status === 'running' && (
  <div className="space-y-1">
    <Progress value={job.progress} className="h-1.5" />
    <div className="flex items-center justify-between">
      <p className="text-xs text-muted-foreground">{Math.round(job.progress)}%</p>
      {isDownloadVideoJob(job) && job.data.downloadSpeedBps != null && (
        <p className="text-xs text-muted-foreground">
          {formatSpeed(job.data.downloadSpeedBps)}
        </p>
      )}
      {isDownloadVideoJob(job) && job.data.downloadEtaSeconds != null && (
        <p className="text-xs text-muted-foreground">
          {formatEta(job.data.downloadEtaSeconds)}
        </p>
      )}
    </div>
  </div>
)}
```

Helper functions for formatting:
```typescript
function formatSpeed(bytesPerSecond: number): string {
  if (bytesPerSecond >= 1_000_000) {
    return `${(bytesPerSecond / 1_000_000).toFixed(1)} MB/s`;
  }
  if (bytesPerSecond >= 1_000) {
    return `${(bytesPerSecond / 1_000).toFixed(0)} KB/s`;
  }
  return `${bytesPerSecond} B/s`;
}

function formatEta(seconds: number): string {
  if (seconds < 60) return `${Math.ceil(seconds)}s`;
  const minutes = Math.floor(seconds / 60);
  const secs = Math.ceil(seconds % 60);
  return `${minutes}m ${secs}s`;
}
```

### 3.7 UI: jobRecordMapper — persist new fields

**File:** `apps/ui/src/lib/jobRecordMapper.ts`

In the `download-video` deserialization branch, map `activeVideoProgress`,
`downloadSpeedBps`, `downloadEtaSeconds` from parsed JSON data.

### 3.8 i18n

No new i18n keys needed. Speed and ETA are displayed as formatted numbers/units.
The "Log" button and status labels are already localized.

## 4. Edge Cases

### 4.1 Missing total_bytes
yt-dlp may report `total_bytes: null` (streaming, live). The progress bar still works
since `_percent_json` is computed from downloaded/total when available, or estimated
otherwise by yt-dlp itself.

### 4.2 Non-JSON stdout lines
yt-dlp emits `[download] Destination: ...` and similar non-JSON lines. These are
always emitted as `stdout` NDJSON messages. Only lines starting with `{` that parse
to valid JSON with a `status` field are treated as progress.

### 4.3 Multiple video download jobs
When a job has multiple videos, `job.progress` represents overall job progress:
`(completed * 100 + current_percent) / total`. Speed and ETA reflect the current
video being downloaded.

### 4.4 Page refresh during download
On page refresh, the job is in `running` state in IDB. On mount, `abortRunningJobsOnMount`
marks it as `aborted`. Progress/speed/eta fields are transient and reset to defaults.

### 4.5 yt-dlp non-download commands
`--newline` and `--progress-template` are only added when the yt-dlp command is used
for download (not for `--list-formats` or `-j`). We detect this by checking if the
args contain `--output` (present in download args via `buildYtdlpDownloadArgs`).

### 4.6 Progress update frequency
yt-dlp emits progress ~2-4 times per second. The `onProgress` callback updates
the Zustand store directly (fast, in-memory). IDB is NOT updated on every progress
event — only on video completion. This avoids excessive IDB writes.

## 5. Tasks

### Task 1: CLI — add progress args and parsing
- [x] File: `apps/cli/src/route/executeCmd.ts`
  - Detect yt-dlp download commands (args contain `--output`)
  - Append `--newline` and `--progress-template` args
  - Parse stdout lines as progress JSON → emit `progress` NDJSON
  - Fall back to `stdout` for non-progress lines

### Task 2: UI — add ExecuteCmdProgressMessage type
- [x] File: `apps/ui/src/api/executeCmd.ts`
  - Add `ExecuteCmdProgressMessage` interface
  - Update `ExecuteCmdMessage` union
  - Update `executeCmdStream` to expose progress via `onProgress` callback
  - (No behavior change for existing callers)

### Task 3: UI — add onProgress to executeCmdToCompletion
- [x] File: `apps/ui/src/lib/whitelistedCmd/executeCmdToCompletion.ts`
  - Add `YtdlpProgressData` interface
  - Add `onProgress` option to both functions
  - Parse `progress` NDJSON messages in `executeCmdToCompletionWithHeaders` stream reader

### Task 4: UI — extend DownloadVideoBackgroundJobData
- [x] File: `apps/ui/src/types/background-jobs.ts`
  - Add `activeVideoProgress`, `downloadSpeedBps`, `downloadEtaSeconds` fields

### Task 5: UI — JobOrchestratorProvider real-time progress
- [x] File: `apps/ui/src/components/JobOrchestratorProvider.tsx`
  - In `executeJob` download-video case, pass `onProgress` callback
  - Calculate overall progress as weighted average
  - Update Zustand store directly via `patchJob`
  - Set `progress` to 100 only after all videos succeed

### Task 6: UI — BackgroundJobsPopoverList speed/ETA display
- [x] File: `apps/ui/src/components/background-jobs/BackgroundJobsPopoverList.tsx`
  - Import `isDownloadVideoJob`
  - Add `formatSpeed` and `formatEta` helpers
  - For running download-video jobs, show speed and ETA below progress bar

### Task 7: UI — jobRecordMapper update
- [x] File: `apps/ui/src/lib/jobRecordMapper.ts`
  - Map new fields in download-video deserialization

### Task 8: Tests
- [x] CLI: test progress NDJSON parsing (unit test in executeCmd.test.ts)
- [x] UI: test BackgroundJobsPopoverList renders speed/eta for download-video jobs
- [x] UI: test jobRecordMapper deserializes new progress fields
- [ ] UI: test JobOrchestratorProvider handles onProgress callback
- [ ] E2E: manual verification with actual yt-dlp download

### Task 9: ExecuteCmdDialog progress display
- [x] File: `apps/ui/src/components/dialogs/ExecuteCmdDialog.tsx` + `types/index.ts`
  - Add `'progress'` to `ExecuteCmdLogEntry['type']`
  - Render progress lines in the log view (green)
  - Display percent, KB/s, ETA

## 6. Verification

- [x] `pnpm typecheck` — all packages pass
- [x] `pnpm test` — unit tests pass (1034 UI + 214 CLI)
- [x] `pnpm build` — CLI + UI build succeeds
- [ ] Manual test: start a yt-dlp download, open BackgroundJobsPopover, verify progress bar moves and speed/ETA display
- [ ] Manual test: multi-video download, verify overall progress is correct
- [ ] Manual test: abort download, verify speed/ETA disappear
