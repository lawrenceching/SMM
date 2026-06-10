# FFmpeg Video Progress Display

Show real-time progress (percentage, ETA) in `BackgroundJobsPopover` for
`ffmpeg-convert` jobs during ffmpeg transcoding / compression execution.

## 1. Background

Currently, ffmpeg video transcoding and compression jobs report only coarse progress:
- `progress = 0` when the job starts
- `progress = 100` when ffmpeg exits successfully
- No real-time per-job percentage or ETA information

The CLI spawns ffmpeg via `executeCmd` and writes stdout/stderr lines (prefixed
with `${ISO} [KIND]`) into `commands/<executionId>/main.log`. ffmpeg emits
structured progress lines on stderr (no special args required):

```
2026-06-09T17:19:22.058Z [STDERR]   Duration: 00:02:59.71, start: 0.000000, bitrate: 793 kb/s
2026-06-09T17:19:22.593Z [STDERR] frame=   77 fps=0.0 q=31.9 size=       0KiB time=00:00:02.50 bitrate=   0.1kbits/s speed=4.77x elapsed=0:00:00.52
2026-06-09T17:19:43.415Z [STDERR] frame= 5390 fps=253 q=39.7 Lsize=    4998KiB time=00:02:59.60 bitrate= 227.9kbits/s speed=8.41x elapsed=0:00:21.34
```

By parsing the **Duration** (total) and the latest `time=` (current) from the
log, we can compute progress percentage and ETA. The log is already polled by
`useCommandLogQuery` for the Log dialog — we compose a new specialized hook on
top of it, mirroring the yt-dlp design in `ytdlp-download-progress.md`.

**Goal**: Display real-time percent + ETA in BackgroundJobsPopover for
`ffmpeg-convert` jobs while they run.

**Out of scope**:
- `ffmpeg-write-tags` jobs (single-frame metadata copy, near-instant).
- Image-format conversions (`jpg`/`png`/`webp`, near-instant).
- `generateFfmpegScreenshots` (run inline, not as a background job).

## 2. Architecture Overview

```
┌──────────────────────────────────────────────────────────────────────────┐
│ apps/cli → runCommand (utils/cmd.ts)                                      │
│                                                                           │
│ Already writes every ffmpeg stderr chunk to `commands/<id>/main.log`.     │
│ No CLI changes required for single-pass jobs.                              │
│                                                                           │
│ 2-pass compression: pass1 + pass2 currently use separate executionIds.     │
│   → switch both to the SAME pre-generated executionId so they share      │
│     one main.log file (continuous progress UI).                           │
└──────────────────────────────────────────┬────────────────────────────────┘
                                           │ main.log lines (unchanged)
                                           ▼
┌──────────────────────────────────────────────────────────────────────────┐
│ apps/ui → useCommandLogQuery (existing)                                   │
│                                                                           │
│ Already polls `/api/command-log/:executionId` every 200ms.               │
│ Shared by LogDialog + popover progress consumers.                         │
└──────────────────────────────────────────┬────────────────────────────────┘
                                           │ log text
                                           ▼
┌──────────────────────────────────────────────────────────────────────────┐
│ apps/ui → NEW useFfmpegProgressQuery                                      │
│                                                                           │
│ extractLatestFfmpegProgress(logText)                                      │
│   • First pass: find latest `Duration: HH:MM:SS.xx` (total)              │
│   • Second pass: find latest `frame=… time=HH:MM:SS.xx …` (current)     │
│   • Returns: { percent, currentSeconds, totalSeconds, etaSeconds }        │
│                                                                           │
│ percent = currentSeconds / totalSeconds × 100                            │
│ etaSeconds = (totalSeconds − currentSeconds) / speedMultiplier           │
│   • speedMultiplier parsed from `speed=8.41x` (ffmpeg's real-time factor)│
│   • Falls back to currentSeconds/elapsedSeconds if `speed=` is unparsable│
└──────────────────────────────────────────┬────────────────────────────────┘
                                           │ FfmpegProgress snapshot
                                           ▼
┌──────────────────────────────────────────────────────────────────────────┐
│ apps/ui → BackgroundJobItem                                                │
│                                                                           │
│ For running ffmpeg-convert jobs:                                          │
│   Progress bar: live percent                                             │
│   Right-aligned: formatEta(live.etaSeconds)                              │
│                                                                           │
│ (yt-dlp hook continues to handle download-video jobs.)                   │
└──────────────────────────────────────────────────────────────────────────┘
```

## 3. Detailed Design

### 3.1 CLI: nothing new for single-pass jobs

The CLI already pipes ffmpeg stderr through `cmdLog.appendStderr(...)` (see
`utils/cmd.ts:spawnAndPump`), which writes each chunk as
`${ISO} [STDERR] ${line}\n`. ffmpeg's default `time=…` progress lines land in
the log automatically.

### 3.2 CLI: share executionId across 2-pass compression

**File:** `apps/ui/src/components/JobOrchestratorProvider.tsx` (lines ~692-728)

Today the 2-pass branch generates a fresh UUID per pass:

```typescript
const pass1Result = await executeCmdToCompletionWithHeaders(
  { command: 'ffmpeg', args: run.pass1Args },
  {
    timeoutMs: JOB_TIMEOUT_MS['ffmpeg-compress'],
    signal: controller.signal,
    executionId: crypto.randomUUID(),  // ← separate
  },
)
// ...
const pass2Result = await executeCmdToCompletionWithHeaders(
  { command: 'ffmpeg', args: run.pass2Args },
  {
    timeoutMs: JOB_TIMEOUT_MS['ffmpeg-compress'],
    signal: controller.signal,
    executionId: crypto.randomUUID(),  // ← separate
  },
)
```

Change: pre-generate ONE `executionId` at the top of the `ffmpeg-convert` case
(both single-pass and 2-pass), and pass it to all `executeCmdToCompletionWithHeaders`
invocations in the case. The CLI already keys the log writer on this id, so
both passes append to the same `commands/<id>/main.log`.

```typescript
case 'ffmpeg-convert': {
  const cd = data as unknown as FfmpegConvertBackgroundJobData
  const executionId = crypto.randomUUID()  // already exists
  const isCompress = cd.compressOptions != null

  if (!isCompress) {
    // pass executionId (already done today)
  } else {
    if (run.kind === 'single') {
      // pass executionId (already done today)
    } else {
      // pass1 + pass2: pass the SAME `executionId` (NEW)
      const pass1Result = await executeCmdToCompletionWithHeaders(
        { command: 'ffmpeg', args: run.pass1Args },
        {
          timeoutMs: JOB_TIMEOUT_MS['ffmpeg-compress'],
          signal: controller.signal,
          executionId,  // was: crypto.randomUUID()
        },
      )
      // ...
      const pass2Result = await executeCmdToCompletionWithHeaders(
        { command: 'ffmpeg', args: run.pass2Args },
        {
          timeoutMs: JOB_TIMEOUT_MS['ffmpeg-compress'],
          signal: controller.signal,
          executionId,  // was: crypto.randomUUID()
        },
      )
    }
  }
}
```

After both passes finish, `data.executionId` already holds the single id (it's
overwritten by the last `passXResult.executionId` only if that differs from
`executionId`; we'll keep `data.executionId = executionId` to be safe).

**Note**: pass 1 of ffmpeg does NOT emit `frame=… time=…` lines (it only
writes a stats file and exits). The popover will simply show no progress
during pass 1 — acceptable, since the duration is short and the existing
50%-after-pass-1 IDB write remains. Once pass 2 starts, normal progress
lines flow and the UI updates as before.

### 3.3 UI: new hook `useFfmpegProgressQuery`

**File:** `apps/ui/src/hooks/useFfmpegProgressQuery.ts` (new)

Mirror `useYtdlpDownloadProgressQuery` but parse ffmpeg's stderr lines.

```typescript
export interface FfmpegProgress {
  /** 0-100 percent of the encode. Null until both Duration and time= are seen. */
  percent: number | null
  /** Encoded seconds (from latest `time=HH:MM:SS.xx`). */
  currentSeconds: number
  /** Total seconds (from latest `Duration: HH:MM:SS.xx`). Null if not yet seen. */
  totalSeconds: number | null
  /** ETA seconds. Null if totalSeconds or speed unavailable. */
  etaSeconds: number | null
  /** Real-time speed multiplier from `speed=Nx` (e.g. 8.41). Null if absent. */
  speedMultiplier: number | null
  /** Local time when this snapshot was extracted. */
  updatedAt: number
}

/**
 * Parse `HH:MM:SS.xx` (or `HH:MM:SS`) into seconds. Returns null on failure.
 */
export function parseHmsTime(value: string): number | null { /* ... */ }

/**
 * Parse a single ffmpeg progress line and return its `time=` and `speed=`
 * fields, or null if the line is not a progress line.
 *
 * Recognised lines start with `frame=` (or contain `frame=` as a token) and
 * include both `time=` and `speed=` (or `time=` only).
 */
export function parseFfmpegProgressLine(line: string): {
  currentSeconds: number
  speedMultiplier: number | null
} | null { /* ... */ }

/**
 * Walk the log text end-to-end and return the latest progress snapshot.
 *
 * - First scans for the most recent `Duration: HH:MM:SS.xx` to get total.
 * - Then scans backward for the most recent `frame=… time=…` to get current.
 *   (The latest `time=` line wins, even if some lines lack `frame=`.)
 */
export function extractLatestFfmpegProgress(logText: string): FfmpegProgress | null { /* ... */ }

export function useFfmpegProgressQuery(args: {
  executionId: string
  isRunning: boolean
  refetchIntervalMs?: number
}): { progress: FfmpegProgress | null; /* … */ }
```

**Key parsing details**:

- Each log line is prefixed with `${ISO} [KIND] `. The parser strips this
  prefix (same regex used by `useYtdlpDownloadProgressQuery`) before matching.
- The progress line regex is deliberately lenient because ffmpeg pads fields
  with spaces:
  ```
  /[ \t]time=(\d{1,2}):(\d{2}):(\d{2})(?:\.(\d+))?/
  ```
- Speed regex:
  ```
  /[ \t]speed=\s*(\d+(?:\.\d+)?)x/
  ```
- Duration regex:
  ```
  /Duration:\s*(\d{1,2}):(\d{2}):(\d{2})(?:\.(\d+))?/
  ```

**ETA calculation** (in priority order):
1. If `speedMultiplier > 0` and `totalSeconds != null`:
   `etaSeconds = (totalSeconds − currentSeconds) / speedMultiplier`
2. Else if `speedMultiplier > 0` and `currentSeconds > 0`:
   use elapsed time fallback (only available if we also parse `elapsed=`).
   For simplicity, return `null` — falling back to no ETA is acceptable.

**Percent clamping**:
- `percent = (currentSeconds / totalSeconds) × 100`, clamped to `[0, 100]`.
- For 2-pass encoding where pass 2 starts from `time=00:00:00.xx`, the percent
  naturally resets — same as yt-dlp's per-video reset behaviour. No special
  handling needed.

### 3.4 UI: `BackgroundJobItem` integration

**File:** `apps/ui/src/components/background-jobs/BackgroundJobItem.tsx`

Extend the existing `useYtdlpDownloadProgressQuery` call with a parallel
`useFfmpegProgressQuery` for `ffmpeg-convert` jobs:

```typescript
import { isFfmpegConvertBackgroundJob } from '@/types/background-jobs'
import { useFfmpegProgressQuery } from '@/hooks/useFfmpegProgressQuery'

// inside component:
const isFfmpeg = isFfmpegConvertBackgroundJob(job)
const executionId = getJobExecutionId(job)
const isJobRunning = job.status === 'running'

const { progress: ytdlpProgress } = useYtdlpDownloadProgressQuery({
  executionId: executionId ?? '',
  isRunning: isDownload && isJobRunning,
})
const { progress: ffmpegProgress } = useFfmpegProgressQuery({
  executionId: executionId ?? '',
  isRunning: isFfmpeg && isJobRunning,
})

// Pick the relevant live snapshot:
const livePercent = isDownload
  ? ytdlpProgress?.percent
  : isFfmpeg
    ? ffmpegProgress?.percent ?? undefined
    : undefined
const etaSeconds = isDownload
  ? ytdlpProgress?.etaSeconds ?? undefined
  : isFfmpeg
    ? ffmpegProgress?.etaSeconds ?? undefined
    : undefined

const overallPercent = Math.max(0, Math.min(100, job.progress))
const percent = livePercent ?? overallPercent
```

Render block (kept lean per user choice — no fps, no speed multiplier):
```tsx
{job.status === 'running' && (
  <div data-testid={`background-job-${job.id}-progress`} className="space-y-1">
    <Progress value={percent} className="h-1.5" />
    <div className="flex items-center justify-between gap-2">
      <p className="text-xs text-muted-foreground">{Math.round(percent)}%</p>
      {etaSeconds != null && (
        <p data-testid={`background-job-${job.id}-eta`} className="text-xs text-muted-foreground">
          {formatEta(etaSeconds)}
        </p>
      )}
    </div>
  </div>
)}
```

The existing `formatDownloadEta` helper is renamed to `formatEta` (or kept
under that name and reused) since both yt-dlp and ffmpeg ETA display the
same format.

### 3.5 Helper rename: `formatDownloadEta` → `formatEta`

**File:** `apps/ui/src/components/background-jobs/BackgroundJobItem.tsx`

Rename `formatDownloadEta` → `formatEta` (its behaviour is generic: it formats
any seconds value as `Xs / Xm Ys / Xh Ym`). Keep `formatDownloadSpeed` as-is
since it's only used for yt-dlp B/s display. Update the in-file test IDs to
remain `*-eta` for backward compat with existing tests.

### 3.6 Tests

#### 3.6.1 New parser unit tests

**File:** `apps/ui/src/hooks/useFfmpegProgressQuery.test.tsx` (new)

Test cases:
- `parseHmsTime` accepts `00:00:02.50`, `00:02:59.71`, `02:00:00`, rejects `bad`.
- `parseFfmpegProgressLine` handles:
  - Standard line with both `time=` and `speed=`.
  - Speed with no decimal (`8x`) and with decimal (`8.41x`).
  - Whitespace variants (`speed= 4.77x`).
  - Returns null for non-progress lines (e.g. `Duration:`, `Stream #0:0`).
- `extractLatestFfmpegProgress`:
  - Empty input → null.
  - Duration found, no progress line yet → `{ percent: null, … }`.
  - Duration + multiple progress lines → returns the latest `time=`.
  - Latest progress line wins over older ones (log contains ~50 entries).
  - Handles CLI log format with `${ISO} [STDERR] ` prefix.
  - ETA calculation: `(total − current) / speed` for `speed=8.41x`.
  - ETA returns null when `speed=` is absent.
- `useFfmpegProgressQuery` end-to-end (mock `fetchCommandLogText`):
  - Returns `null` for empty log.
  - Polls only while `isRunning` is true.
  - Returns parsed percent when log has progress lines.

#### 3.6.2 Update `BackgroundJobsPopoverList.test.tsx`

Mock `useFfmpegProgressQuery` alongside the existing yt-dlp mock, then add
cases:
- Running ffmpeg-convert job with `{ percent: 42, etaSeconds: 95 }` renders
  ETA `1m 35s` and percent `42%`.
- Running ffmpeg-convert job with `percent: null` (still waiting for Duration)
  falls back to `job.progress` and shows no ETA element.
- No speed line is rendered for ffmpeg jobs (only for download-video).

#### 3.6.3 Update `BackgroundJobItem.test.tsx`

Same pattern as `BackgroundJobsPopoverList.test.tsx`: mock both hooks, add a
test asserting the ETA element is present for an ffmpeg job with live
progress.

### 3.7 No i18n changes

The popover already uses unitless display strings (`42%`, `1m 35s`). The new
ETA helper reuses the existing format. No new translation keys are needed.

## 4. Edge Cases

### 4.1 Image-format conversions
ffmpeg writes a single `frame= 1 fps=0.0 … time=00:00:00.00 …` line then
exits. `totalSeconds` may be absent (no `Duration:` line for image inputs).
→ percent stays null, no ETA. Popover shows the static `job.progress` from
IDB (typically 0 → 100 jump on success). Acceptable for the fast path.

### 4.2 `ffmpeg-write-tags` jobs
Excluded by design (out of scope). The hook isn't called for these jobs,
so the popover continues to show the pre-existing static progress.

### 4.3 Page refresh during a long transcode
Same as today: the job is marked `aborted` by `abortRunningJobsOnMount`. The
new fields are transient (only ever parsed from the log, never persisted to
IDB).

### 4.4 Two-pass compression
- Pass 1 emits no `frame=` lines → popover shows no live progress, IDB still
  writes `progress: 50` after pass 1.
- Pass 2 starts from `time=00:00:00.xx` → percent resets to 0 and climbs to
  100. Same as how yt-dlp resets per-video percent.
- Both passes write to the same `main.log` thanks to the shared
  `executionId` change.

### 4.5 Concurrency model unchanged
The new hook is purely a derived computation over `useCommandLogQuery`. It
adds no new HTTP requests (the query client deduplicates by `['command-log',
executionId]`), no SW messages, no IDB writes.

### 4.6 Encoding codecs without standard progress lines
Some encoders omit `frame=` or `time=` lines (rare). Parser returns null;
popover shows IDB's `job.progress` only.

## 5. Tasks

### Task 1: CLI — share executionId across 2-pass compression
- [x] File: `apps/ui/src/components/JobOrchestratorProvider.tsx`
  - In the `ffmpeg-convert` 2-pass branch, pass the case-level `executionId`
    to both `executeCmdToCompletionWithHeaders` invocations instead of
    generating new UUIDs per pass.
  - Verify the resulting `data.executionId` matches the single executionId.

### Task 2: UI — new `useFfmpegProgressQuery` hook
- [x] File: `apps/ui/src/hooks/useFfmpegProgressQuery.ts` (new)
  - Implement `parseHmsTime`, `parseFfmpegProgressLine`,
    `extractLatestFfmpegProgress`, `useFfmpegProgressQuery`.
  - Compose over the existing `useCommandLogQuery`.
  - Default `refetchIntervalMs: 200` (matches yt-dlp).
- [x] File: `apps/ui/src/hooks/useFfmpegProgressQuery.test.tsx` (new)
  - Cover all parsing helpers + hook integration (26 tests).

### Task 3: UI — wire hook into `BackgroundJobItem`
- [x] File: `apps/ui/src/components/background-jobs/BackgroundJobItem.tsx`
  - Add `useFfmpegProgressQuery` call guarded by
    `isFfmpegConvertBackgroundJob(job)`.
  - Compute `livePercent` / `etaSeconds` from the relevant hook.
  - Render `eta` element when both kinds of jobs have an ETA.
  - Rename `formatDownloadEta` → `formatEta`.
- [x] File: `apps/ui/src/components/background-jobs/BackgroundJobItem.test.tsx`
  - Add test for ffmpeg-convert job rendering percent + ETA.
- [x] File: `apps/ui/src/components/background-jobs/BackgroundJobsPopoverList.test.tsx`
  - Add test for ffmpeg-convert job rendering percent + ETA.

### Task 4: Type guard already exists
- [x] `isFfmpegConvertBackgroundJob` is already exported from
  `apps/ui/src/types/background-jobs.ts`. No new type guard needed.

## 6. Backward Compatibility

- `data.executionId` for 2-pass compression jobs now holds the same value
  it held before for pass 2 (the LAST `executeCmdToCompletionWithHeaders`
  call). Old IDB records still deserialize correctly via `jobRecordMapper`.
- `data.executionId` semantics: still points to a single, valid executionId
  whose log can be opened via `/api/command-log/:id`. The log now also
  contains pass-1 lines — LogDialog shows them as a bonus.
- LogDialog already shows raw lines; no format change.

## 7. Documents

- [x] `.agents/docs/design/ffmpeg-progress-display.md` (this file)
- [ ] No user-guide changes required (UI string output unchanged).

## 8. Post Verification

- [x] `apps/ui` `pnpm exec tsc --noEmit` — passes (cli pre-existing errors unrelated)
- [x] `pnpm test` (apps/ui) — 1279 passed, 23 skipped
- [x] `pnpm test` (apps/cli) — 289 passed, 13 skipped
- [x] `pnpm build` — UI + CLI build succeeds
- [ ] Manual: start a video conversion in MusicPanel, verify the popover
      shows percent and ETA, and that Log dialog opens with the expected
      lines
- [ ] Manual: start a 2-pass compression, verify percent resets between
      passes and ETA updates accordingly