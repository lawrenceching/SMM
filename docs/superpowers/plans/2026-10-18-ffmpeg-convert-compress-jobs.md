# FfmpegConvertJob + FfmpegCompressJob Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move format conversion and video compression from UI IndexedDB/Orchestrator onto Core (`FfmpegConvertJob` / `FfmpegCompressJob`) with a new `FfmpegPort`, dedicated `ffmpeg` queue, HTTP, CLI, and UI mirroring; leave `ffmpeg-write-tags` on Orchestrator.

**Architecture:** Two AbstractJob subclasses share queue `ffmpeg` (concurrency 1). Convert timeout 1h; compress 2h. Jobs call `FfmpegPort` (`ffmpeg` | `ffprobe`), parse stderr for progress into snapshots. Server adapter timeout ≥2h. UI dialogs POST + Zustand poll; Orchestrator fail-fast on legacy `ffmpeg-convert` IDB rows.

**Tech Stack:** TypeScript, Vitest, Bun/Hono, React 19, Zustand, Commander. Spec: [2026-10-18-ffmpeg-convert-compress-jobs-design.md](../specs/2026-10-18-ffmpeg-convert-compress-jobs-design.md). Prior art: [2026-10-18-synthesize-process-subtitle-jobs.md](./2026-10-18-synthesize-process-subtitle-jobs.md), `YtdlpJob`, `VideoCaptionerPort` server adapter.

## Global Constraints

- Two Job kinds + **shared** `ffmpeg` queue (do not add separate convert/compress queues).
- New `FfmpegPort` — do **not** widen `CommandPort` beyond `yt-dlp`.
- Progress source of truth = Job snapshot (`progress` / `etaSeconds`); do not keep UI command-log progress as a second source for Core jobs.
- `ffmpeg-write-tags` stays on Orchestrator; do not migrate it.
- Browser must not import `@smm/core` root barrel (subpath constants OK).
- Paths: callers pass host platform absolute paths; Core does not POSIX↔platform convert.
- Prefer copying patterns from `SynthesizeSubtitleJob` / `YtdlpJob` / `createVideoCaptionerPort` / `pollSubtitleJob` / `smm synthesize`.

---

## File structure

| Path | Responsibility |
|------|----------------|
| `apps/core/src/ports/FfmpegPort.ts` | Port interface |
| `apps/core/src/types.ts` | `PlatformPorts.ffmpeg?` |
| `apps/core/src/jobs/jobManager.ts` (+ test) | Queue name `"ffmpeg"` |
| `apps/core/src/pipeline/ffmpeg/progress.ts` (+ test) | stderr progress parsing |
| `apps/core/src/pipeline/ffmpeg/probe.ts` (+ test) | ffprobe JSON → `FfmpegCompressProbe` |
| `apps/core/src/pipeline/ffmpeg/ffmpegJobsApi.ts` (+ test) | Request types + asserts |
| `apps/core/src/jobs/types.ts` | Snapshots + `Job` union |
| `apps/core/src/jobs/FfmpegConvertJob.ts` (+ test) | Convert job |
| `apps/core/src/jobs/FfmpegCompressJob.ts` (+ test) | Compress job (probe + 1/2-pass) |
| `apps/core/src/Core.ts` / `index.ts` | Public API + exports |
| `apps/server/src/core/FfmpegPort.ts` | Host adapter timeout ≥2h |
| `apps/server/src/core/getCore.ts` | Inject `ffmpeg` port |
| `apps/server/src/route/FfmpegConvert.ts` | HTTP |
| `apps/server/src/route/FfmpegCompress.ts` | HTTP |
| `apps/server/src/route/serializeJob.ts` / `app.ts` | Wire |
| `apps/cli/.../convert.ts` / `compress.ts` (+ tests) | CLI |
| `apps/ui/src/api/ffmpegConvert.ts` / `ffmpegCompress.ts` | RPC clients |
| `apps/ui/src/types/background-jobs.ts` | Core mirror types |
| `apps/ui/src/lib/pollFfmpegJob.ts` | Upsert + poll Core ffmpeg jobs |
| `apps/ui/.../format-converter-dialog.tsx` | Core enqueue |
| `apps/ui/.../useCreateFfmpegCompressJobMutation.ts` + VideoCompression dialog | Core enqueue |
| `apps/ui/.../JobOrchestratorProvider.tsx` | Fail-fast convert; keep write-tags |
| `apps/ui/src/lib/ffmpegConvertJobFactory.ts` / `ffmpegCompressJobFactory.ts` | Delete |
| `docs/dev/job.md` / `docs/api/index.md` / `docs/superpowers/design/ffmpeg-operations.md` | Docs |

---

### Task 1: `FfmpegPort` + `PlatformPorts`

**Files:**
- Create: `apps/core/src/ports/FfmpegPort.ts`
- Modify: `apps/core/src/types.ts`
- Modify: `apps/core/src/index.ts` (re-export port types)

**Interfaces:**
- Produces: `FfmpegPort`, `FfmpegRunRequest`, `FfmpegRunResult`; `PlatformPorts.ffmpeg?: FfmpegPort`

- [ ] **Step 1: Add port**

```ts
export interface FfmpegRunRequest {
  command: "ffmpeg" | "ffprobe";
  args: string[];
  onStdoutLine?: (line: string) => void;
  onStderrLine?: (line: string) => void;
}

export interface FfmpegRunResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

export interface FfmpegPort {
  run(request: FfmpegRunRequest, signal: AbortSignal): Promise<FfmpegRunResult>;
}
```

- [ ] **Step 2: Wire `PlatformPorts` / `PlatformPortsInput`**

```ts
import type { FfmpegPort } from "./ports/FfmpegPort";
// PlatformPorts + PlatformPortsInput:
ffmpeg?: FfmpegPort;
```

Re-export from `apps/core/src/index.ts`.

- [ ] **Step 3: Commit**

```bash
git add apps/core/src/ports/FfmpegPort.ts apps/core/src/types.ts apps/core/src/index.ts
git commit -m "feat(core): add FfmpegPort for ffmpeg and ffprobe"
```

---

### Task 2: JobManager `ffmpeg` queue

**Files:**
- Modify: `apps/core/src/jobs/jobManager.ts`
- Modify: `apps/core/src/jobs/jobManager.test.ts`

**Interfaces:**
- Consumes: none new
- Produces: `JobQueueName` includes `"ffmpeg"`; `queueFor("ffmpeg")` → PQueue concurrency 1

- [ ] **Step 1: Failing test** — submit two slow jobs with `{ queue: "ffmpeg" }`; assert second does not start until first finishes (copy videocaptioner serial test pattern in `jobManager.test.ts`).

- [ ] **Step 2: Run test — expect FAIL** (unknown queue or both run in parallel)

Run: `pnpm --filter @smm/core exec vitest run src/jobs/jobManager.test.ts`

- [ ] **Step 3: Implement**

```ts
export type JobQueueName = "default" | "ytdlp" | "videocaptioner" | "ffmpeg";

// private _ffmpegQueue: PQueue | undefined;
// getter ffmpegQueue: concurrency 1
// queueFor: if name === "ffmpeg" return this.ffmpegQueue
```

- [ ] **Step 4: Green + commit**

```bash
pnpm --filter @smm/core exec vitest run src/jobs/jobManager.test.ts
git commit -m "feat(core): add JobManager ffmpeg queue concurrency 1"
```

---

### Task 3: Progress + probe helpers

**Files:**
- Create: `apps/core/src/pipeline/ffmpeg/progress.ts`
- Create: `apps/core/src/pipeline/ffmpeg/progress.test.ts`
- Create: `apps/core/src/pipeline/ffmpeg/probe.ts`
- Create: `apps/core/src/pipeline/ffmpeg/probe.test.ts`

**Interfaces:**
- Produces:
  - `parseHmsTime(value: string): number | null`
  - `parseFfmpegProgressLine(line: string): { currentSeconds: number; speedMultiplier: number | null } | null`
  - `parseDurationSeconds(line: string): number | null` — match `\bDuration:\s*(HH:MM:SS…)`
  - `computeFfmpegProgress(opts: { currentSeconds: number; totalSeconds: number; speedMultiplier: number | null; mapStart: number; mapEnd: number }): { progress: number; etaSeconds?: number }`
  - `parseFfprobeJson(stdout: string): FfmpegCompressProbe` — import probe type from `whitelistedCmd/ffmpeg`

Logic ported from `apps/ui/src/hooks/useFfmpegProgressQuery.ts` (no log-prefix stripping required for Port lines; still tolerate prefixed lines).

`computeFfmpegProgress`:  
`raw = current/total * 100` clamped 0–100;  
`progress = mapStart + (raw/100) * (mapEnd - mapStart)`;  
eta from remaining / speed when speed > 0.

`parseFfprobeJson`: same shape as Orchestrator `probeVideoForCompression` JSON parse; on failure return `{ durationSec: 0, width: 0, height: 0 }`.

- [ ] **Step 1: Failing tests** — progress line with time+speed; Duration parse; map 0–50 / 50–100; ffprobe JSON width/height/duration; malformed → empty probe.

- [ ] **Step 2: Implement + green**

```bash
pnpm --filter @smm/core exec vitest run src/pipeline/ffmpeg/progress.test.ts src/pipeline/ffmpeg/probe.test.ts
```

- [ ] **Step 3: Commit**

```bash
git commit -m "feat(core): add ffmpeg progress and ffprobe parse helpers"
```

---

### Task 4: Snapshot types

**Files:**
- Modify: `apps/core/src/jobs/types.ts`
- Modify: `apps/core/src/index.ts`

**Interfaces:**
- Produces: `FfmpegConvertJobSnapshot`, `FfmpegCompressJobSnapshot`; extend `Job` union

- [ ] **Step 1: Add snapshots**

```ts
export interface FfmpegConvertJobSnapshot {
  kind: "ffmpeg-convert";
  id: string;
  type: "ffmpeg-convert";
  folder: string;
  inputPath: string;
  outputPath: string;
  outputFormat: string;
  preset: string;
  title?: string;
  imageOptions?: FfmpegConvertImageOptions;
  status: JobStatus;
  progress: number;
  etaSeconds?: number | null;
  error?: string;
  createdAt: number;
  updatedAt: number;
}

export interface FfmpegCompressJobSnapshot {
  kind: "ffmpeg-compress";
  id: string;
  type: "ffmpeg-compress";
  folder: string;
  inputPath: string;
  outputPath: string;
  title?: string;
  compressOptions: FfmpegCompressOptions;
  status: JobStatus;
  progress: number;
  etaSeconds?: number | null;
  error?: string;
  createdAt: number;
  updatedAt: number;
}
```

Import `FfmpegConvertImageOptions` / `FfmpegCompressOptions` from `../whitelistedCmd/constants`.

Extend `Job` union. Re-export from `index.ts`.

- [ ] **Step 2: Commit**

```bash
git commit -m "feat(core): add ffmpeg convert/compress job snapshot types"
```

---

### Task 5: `FfmpegConvertJob`

**Files:**
- Create: `apps/core/src/jobs/FfmpegConvertJob.ts`
- Create: `apps/core/src/jobs/FfmpegConvertJob.test.ts`
- Modify: `apps/core/src/index.ts`

**Interfaces:**
- Consumes: `FfmpegPort`, `buildFfmpegConvertArgs`, progress helpers
- Produces: `FfmpegConvertJob`, `FfmpegConvertJobOptions`

Pattern: `SynthesizeSubtitleJob` + Ytdlp-style stderr progress.

```ts
export interface FfmpegConvertJobOptions {
  folder: string;
  inputPath: string;
  outputPath: string;
  outputFormat: FfmpegConvertFormat; // exclude compress-* tokens in assert layer
  preset: FfmpegConvertPreset;
  title?: string;
  imageOptions?: FfmpegConvertImageOptions;
}
```

- [ ] **Step 1: Failing tests**
  - exit 0 → `succeeded`, progress 100, `kind: "ffmpeg-convert"`
  - `Port.run` called with `command: "ffmpeg"` and args from `buildFfmpegConvertArgs(...)`
  - stderr with Duration + time= → progress updates before completion (spy `toJSON().progress` mid-run via onStderrLine side effect, or inject fake port that emits lines then resolves)
  - exit 1 → `failed` + `error`
  - abort before/during run → `aborted`
  - missing `ffmpeg` port → `failed`

- [ ] **Step 2: Implement**
  - `type: "ffmpeg-convert"`
  - private progressPct (default 0), etaSeconds?, totalSeconds?, abortController
  - `onStderrLine`: parse Duration once; parse progress lines; `computeFfmpegProgress({ mapStart: 0, mapEnd: 100 })`; `setProgress`; touch
  - `run()`: requireFfmpeg → `buildFfmpegConvertArgs(inputPath, outputPath, outputFormat, preset, imageOptions)` → `ffmpeg.run({ command: "ffmpeg", args, onStderrLine }, signal)`
  - AbortError → aborted; exit≠0 → failed with stderr/message
  - success → setProgress(100), succeeded

- [ ] **Step 3: Green + commit**

```bash
pnpm --filter @smm/core exec vitest run src/jobs/FfmpegConvertJob.test.ts
git commit -m "feat(core): add FfmpegConvertJob"
```

---

### Task 6: `FfmpegCompressJob`

**Files:**
- Create: `apps/core/src/jobs/FfmpegCompressJob.ts`
- Create: `apps/core/src/jobs/FfmpegCompressJob.test.ts`
- Modify: `apps/core/src/index.ts`

**Interfaces:**
- Consumes: `FfmpegPort`, `buildFfmpegCompressArgs`, `parseFfprobeJson`, progress helpers, `FsPort.deleteFile`
- Produces: `FfmpegCompressJob`, `FfmpegCompressJobOptions`

```ts
export interface FfmpegCompressJobOptions {
  folder: string;
  inputPath: string;
  outputPath: string;
  compressOptions: FfmpegCompressOptions;
  title?: string;
}
```

FFPROBE_ARGS (match Orchestrator):

```ts
["-v", "error", "-print_format", "json", "-show_format", "-show_streams", inputPath]
```

- [ ] **Step 1: Failing tests**
  - single-pass: ffprobe then one ffmpeg; exit 0 → succeeded
  - two-pass: `buildFfmpegCompressArgs` returns `kind: "two-pass"` → two ffmpeg runs; after pass1 progress ≈50 (or ≥50 before pass2); final 100
  - pass1 fail → failed; no pass2 call
  - abort → aborted
  - `toJSON().kind === "ffmpeg-compress"` and includes `compressOptions`
  - pass log path: after success/fail, `deleteFile(passLogPath)` called when two-pass (best-effort; mock fs)

- [ ] **Step 2: Implement**
  - Probe via `ffmpeg.run({ command: "ffprobe", args: FFPROBE_ARGS }, signal)` → `parseFfprobeJson(stdout)`
  - `const run = buildFfmpegCompressArgs(inputPath, outputPath, compressOptions, probe)`
  - single: mapStart 0 mapEnd 100
  - two-pass: pass1 map 0–50; pass2 map 50–100; `finally`/`try` cleanup `ports.fs.deleteFile(run.passLogPath)` (ignore errors)
  - Shared AbortController across probe + passes

- [ ] **Step 3: Green + commit**

```bash
pnpm --filter @smm/core exec vitest run src/jobs/FfmpegCompressJob.test.ts
git commit -m "feat(core): add FfmpegCompressJob with probe and two-pass"
```

---

### Task 7: Core API `ffmpegConvert` / `ffmpegCompress`

**Files:**
- Create: `apps/core/src/pipeline/ffmpeg/ffmpegJobsApi.ts`
- Create: `apps/core/src/pipeline/ffmpeg/ffmpegJobsApi.test.ts`
- Modify: `apps/core/src/Core.ts`
- Modify: `apps/core/src/index.ts`

**Interfaces:**
- Produces: `FfmpegConvertRequest`, `FfmpegCompressRequest`, `assertFfmpegConvertRequest`, `assertFfmpegCompressRequest`, `Core.ffmpegConvert`, `Core.ffmpegCompress`

```ts
export interface FfmpegConvertRequest {
  folder: string;
  inputPath: string;
  outputPath: string;
  outputFormat: FfmpegConvertFormat;
  preset: FfmpegConvertPreset;
  title?: string;
  imageOptions?: FfmpegConvertImageOptions;
}

export interface FfmpegCompressRequest {
  folder: string;
  inputPath: string;
  outputPath: string;
  compressOptions: FfmpegCompressOptions;
  title?: string;
}
```

Asserts: trim required strings; reject empty folder/inputPath/outputPath; convert must **not** use `isFfmpegCompressFormat(outputFormat)` (those tokens are legacy UI-only — compress goes through compress API); require `compressOptions.container` / `videoEncoder` presence as needed for a valid options object (minimal: `typeof compressOptions === "object"` + container + videoEncoder).

Core methods (mirror `synthesizeSubtitle`):

```ts
// require ports.ffmpeg
// assert request
// new FfmpegConvertJob(...) → jobManager.submit(job, (), { queue: "ffmpeg", timeoutMs: 60 * 60 * 1000 })
// new FfmpegCompressJob(...) → submit({ queue: "ffmpeg", timeoutMs: 2 * 60 * 60 * 1000 })
// return { id: job.id }
```

- [ ] **Step 1: Failing API tests** — assert rejects missing paths; convert rejects compress-* format; happy path returns id (fake JobManager/ports as in `subtitleJobsApi.test.ts`).

- [ ] **Step 2: Implement Core methods + exports**

- [ ] **Step 3: Green + commit**

```bash
pnpm --filter @smm/core exec vitest run src/pipeline/ffmpeg/ffmpegJobsApi.test.ts
git commit -m "feat(core): enqueue ffmpegConvert and ffmpegCompress on ffmpeg queue"
```

---

### Task 8: Server `FfmpegPort` + getCore injection

**Files:**
- Create: `apps/server/src/core/FfmpegPort.ts`
- Create: `apps/server/src/core/FfmpegPort.test.ts` (assert `FFMPEG_TIMEOUT_MS >= 2 * 60 * 60 * 1000`; export the constant for the test)
- Modify: `apps/server/src/core/getCore.ts`
- Modify: CLI getCore path if CLI constructs ports separately — check `apps/cli` uses `getCore` from server; inject there only

**Interfaces:**
- Produces: `createFfmpegPort(): FfmpegPort`

Copy `createVideoCaptionerPort` structure:

```ts
const FFMPEG_TIMEOUT_MS = 2 * 60 * 60 * 1000

export function createFfmpegPort(): FfmpegPort {
  return {
    async run(request, signal) {
      const resolved = await resolveCommand(request.command) // "ffmpeg" | "ffprobe"
      // not-found → exitCode 127
      const cmdLog = await createCommandExecutionLogWriter()
      await runCommand({
        executablePath: resolved.executablePath,
        command: request.command,
        args: request.args,
        tty: false,
        cmdLog,
        timeoutMs: FFMPEG_TIMEOUT_MS,
        abortSignal: signal,
        sink: { stdout, stderr, progress: () => {}, system: exit/timeout/error },
      })
      if (signal.aborted) throw AbortError
      return { exitCode, stdout, stderr }
    },
  }
}
```

`getCore` ports:

```ts
command: createYtdlpCommandPort(),
videoCaptioner: createVideoCaptionerPort(),
ffmpeg: createFfmpegPort(),
```

Also wire `ffmpeg` wherever CLI `platformPorts()` / Core construction duplicates ports (search `videoCaptioner:` in apps/cli and mirror).

- [ ] **Step 1: Implement + typecheck**

```bash
pnpm --filter server exec tsc --noEmit
```

- [ ] **Step 2: Commit**

```bash
git commit -m "feat(server): add FfmpegPort adapter and inject into getCore"
```

---

### Task 9: HTTP routes + serializeJob

**Files:**
- Create: `apps/server/src/route/FfmpegConvert.ts`
- Create: `apps/server/src/route/FfmpegCompress.ts`
- Modify: `apps/server/src/route/serializeJob.ts`
- Modify: `apps/server/app.ts`

**Interfaces:**
- Produces: `POST /api/ffmpeg-convert`, `POST /api/ffmpeg-compress` → `{ data: { id } } | { error }`

Pattern: copy `SynthesizeSubtitle.ts`.

Convert body: `folder`, `inputPath`, `outputPath`, `outputFormat`, `preset`, optional `title`, `imageOptions`.  
Compress body: `folder`, `inputPath`, `outputPath`, `compressOptions`, optional `title`.

`serializeJob`: `instanceof FfmpegConvertJob | FfmpegCompressJob` → `toJSON()`.

Mount in `createApp()` `.route()` chain.

- [ ] **Step 1: Implement routes + serialize + mount**

- [ ] **Step 2: Typecheck**

```bash
pnpm run typecheck:server
```

- [ ] **Step 3: Commit**

```bash
git commit -m "feat(server): add ffmpeg-convert and ffmpeg-compress HTTP routes"
```

---

### Task 10: CLI `smm convert` / `smm compress`

**Files:**
- Create: `apps/cli/src/cli/commands/convert.ts`
- Create: `apps/cli/src/cli/commands/convert.test.ts`
- Create: `apps/cli/src/cli/commands/compress.ts`
- Create: `apps/cli/src/cli/commands/compress.test.ts`
- Modify: `apps/cli/src/cli/runCli.ts`
- Ensure CLI Core construction includes `ffmpeg` port (Task 8)

**Interfaces:**
- Produces: Commander commands `convert`, `compress`

Pattern: `synthesize.ts` — `getCore({ logger, _ports })` → `core.ffmpegConvert|Compress` → `waitForJobUntilCompleted` → exit 0 if succeeded else 1.

```bash
smm convert <input> -o/--output <path> --folder <path> --format <fmt> --preset <preset> [--title …] [-v]
smm compress <input> -o/--output <path> --folder <path> --container mp4|mkv|webm|mov [flags for compress options or --options-json] [--title …] [-v]
```

For compress CLI flags: minimum viable is `--container` + reuse `DEFAULT_FFMPEG_COMPRESS_OPTIONS` with overrides for `presetKey`, `crf`, `videoEncoder`, `twoPass` boolean — enough for tests. Do not invent a full CLI parity with every UI field in v1; document accepted flags in `--help`.

Tests: fake `FfmpegPort` exit 0 → CLI 0; exit 1 → CLI 1; assert `run` called with `command: "ffmpeg"` (compress also asserts ffprobe first).

- [ ] **Step 1: Implement + register in runCli**

- [ ] **Step 2: Green**

```bash
cd apps/cli && pnpm exec vitest run src/cli/commands/convert.test.ts src/cli/commands/compress.test.ts
```

- [ ] **Step 3: Commit**

```bash
git commit -m "feat(cli): add smm convert and smm compress"
```

---

### Task 11: UI API clients + mirror types + poll

**Files:**
- Create: `apps/ui/src/api/ffmpegConvert.ts`
- Create: `apps/ui/src/api/ffmpegCompress.ts`
- Create: `apps/ui/src/lib/pollFfmpegJob.ts`
- Modify: `apps/ui/src/types/background-jobs.ts`
- Modify: `apps/ui/src/api/getJob.ts` — Extract union for new kinds
- Modify: `apps/ui/src/hooks/useJobManager.ts`
- Modify: `apps/ui/src/components/hooks/useBackgroundJobsIndicator.ts`
- Modify: `apps/ui/src/components/background-jobs/*` as needed so Core ffmpeg jobs show snapshot progress (not `useFfmpegProgressQuery`)

**Interfaces:**
- Produces:
  - `ffmpegConvertViaCore(req): Promise<{ id: string }>`
  - `ffmpegCompressViaCore(req): Promise<{ id: string }>`
  - Mirror: `type: 'ffmpeg-convert' | 'ffmpeg-compress'` (Core kinds) with `data` holding folder/paths/options + top-level progress/eta from poll
  - Keep legacy IDB `ffmpeg-convert` type for history mapper

Mirror jobs are **not** IndexedDB. Guards: `isCoreFfmpegConvertJob` / `isCoreFfmpegCompressJob` (name clearly vs legacy).

`useJobManager` stop/remove: Core mirrors use `stopJobViaCore` (same as ytdlp/subtitle).

Poll: upsert pending → poll get-job → apply progress/status/etaSeconds → terminal.

Background list: for Core ffmpeg kinds, render `job.progress` / `etaSeconds` from store; do **not** call `useFfmpegProgressQuery` for those ids.

- [ ] **Step 1: Implement API + types + poll + job manager wiring**

- [ ] **Step 2: Commit**

```bash
git commit -m "feat(ui): add Core ffmpeg convert/compress API clients and mirror types"
```

---

### Task 12: UI dialogs enqueue via Core

**Files:**
- Modify: `apps/ui/src/components/dialogs/format-converter-dialog.tsx` (+ test)
- Modify: `apps/ui/src/hooks/ffmpeg/useCreateFfmpegCompressJobMutation.ts` (+ test)
- Modify: Video compression dialog path if it does not go through the mutation
- Delete: `apps/ui/src/lib/ffmpegConvertJobFactory.ts`
- Delete: `apps/ui/src/lib/ffmpegCompressJobFactory.ts` (+ update/delete their tests)
- Keep: `ffmpegWriteTagsJobFactory.ts`

**Interfaces:**
- Consumes: `ffmpegConvertViaCore` / `ffmpegCompressViaCore`, poll upsert helpers

Format converter Start:
1. Build request (platform paths via `Path.toPlatformPath` as today)
2. `const { id } = await ffmpegConvertViaCore(...)`
3. Upsert mirror + start poll
4. Close dialog
5. **Do not** call `createJob` / Orchestrator

Compress mutation: same with `ffmpegCompressViaCore`; body includes `compressOptions` (no need for opaque `compress-mp4` format token on Core path).

Tests: mock API; assert no `createJob`; assert Core client called with expected fields.

- [ ] **Step 1: Failing dialog/mutation tests updated for Core path**

- [ ] **Step 2: Implement + delete factories + green**

```bash
pnpm --filter ui exec vitest run src/components/dialogs/format-converter-dialog.test.tsx src/hooks/ffmpeg/useCreateFfmpegCompressJobMutation.test.tsx
```

- [ ] **Step 3: Commit**

```bash
git commit -m "feat(ui): enqueue ffmpeg convert/compress via Core HTTP"
```

---

### Task 13: Orchestrator teardown (convert only)

**Files:**
- Modify: `apps/ui/src/components/JobOrchestratorProvider.tsx`
- Modify related tests if any assert convert execution

**Interfaces:**
- Consumes: none
- Produces: fail-fast for `ffmpeg-convert`; **unchanged** `ffmpeg-write-tags`

Replace `case 'ffmpeg-convert':` body with:

```ts
data.error =
  'FFmpeg convert/compress jobs now run via Core; restart from the Format Converter or Video Compression dialog.'
record.data = JSON.stringify(data)
record.status = 'failed'
break
```

Remove dead imports used only by convert/compress (`buildFfmpegConvertArgs`, `buildFfmpegCompressArgs`, `probeVideoForCompression`, `cleanupPassLog` if unused). Keep write-tags imports/logic/`JOB_TIMEOUT_MS['ffmpeg-write-tags']`. Can remove `ffmpeg-convert` / `ffmpeg-compress` timeout entries.

- [ ] **Step 1: Implement fail-fast + prune imports**

- [ ] **Step 2: Commit**

```bash
git commit -m "refactor(ui): fail-fast legacy IDB ffmpeg-convert; keep write-tags"
```

---

### Task 14: Docs + verification gate

**Files:**
- Modify: `docs/dev/job.md`
- Modify: `docs/api/index.md`
- Modify: `docs/superpowers/design/ffmpeg-operations.md`

- [ ] **Step 1: Docs**
  - job.md: fourth queue `ffmpeg`; kinds; timeouts; CLI; note write-tags still Orchestrator
  - api/index.md: two POST endpoints
  - ffmpeg-operations.md: pipeline diagram → Core Job

- [ ] **Step 2: Verification**

```bash
pnpm --filter @smm/core exec vitest run src/jobs/FfmpegConvertJob.test.ts src/jobs/FfmpegCompressJob.test.ts src/pipeline/ffmpeg/progress.test.ts src/pipeline/ffmpeg/probe.test.ts src/pipeline/ffmpeg/ffmpegJobsApi.test.ts src/jobs/jobManager.test.ts
cd apps/cli && pnpm exec vitest run src/cli/commands/convert.test.ts src/cli/commands/compress.test.ts
pnpm --filter ui exec vitest run src/components/dialogs/format-converter-dialog.test.tsx src/hooks/ffmpeg/useCreateFfmpegCompressJobMutation.test.tsx
pnpm run typecheck:core && pnpm run typecheck:server && pnpm run typecheck:cli && pnpm run typecheck:ui
```

- [ ] **Step 3: Commit**

```bash
git commit -m "docs: document Core ffmpeg convert/compress jobs, queue, and HTTP/CLI"
```

---

## Self-review (plan vs spec)

| Spec requirement | Task |
|------------------|------|
| Dual jobs convert + compress | 5, 6 |
| Shared `ffmpeg` queue concurrency 1 | 2, 7 |
| Timeouts 1h / 2h | 7 |
| `FfmpegPort` not widen CommandPort | 1, 8 |
| Port timeout ≥2h | 8 |
| Progress in snapshot; two-pass 0–50/50–100 | 3, 5, 6 |
| HTTP two routes + serialize | 9 |
| CLI convert + compress | 10 |
| UI dialogs Core; delete factories | 11, 12 |
| Orchestrator fail-fast convert; keep write-tags | 13 |
| Docs | 14 |
| Out of scope write-tags migration | 13 (explicit keep) |
| No browser `@smm/core` root | 11–12 (apiFetch/rpc only) |

No TBD/TODO placeholders remain in task steps.
