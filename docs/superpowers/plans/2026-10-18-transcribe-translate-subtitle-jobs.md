# TranscribeSubtitleJob + TranslateSubtitleJob Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move generate-subtitle and translate-subtitle from UI IndexedDB/Orchestrator onto Core jobs (`TranscribeSubtitleJob` / `TranslateSubtitleJob`) with `VideoCaptionerPort`, HTTP enqueue, CLI wait, and UI snapshot mirroring — matching the `YtdlpJob` pattern.

**Architecture:** Core owns argv (whitelist builders) and job lifecycle; server injects `VideoCaptionerPort` via `runCommand('videocaptioner')`; JobManager adds a `videocaptioner` queue (concurrency 1, 10 min timeout); UI dialogs POST to Core and mirror snapshots into Zustand; Orchestrator keeps synthesize/process only.

**Tech Stack:** TypeScript, Vitest, Bun/Hono, React 19, Zustand, Commander CLI. Spec: [2026-10-17-transcribe-translate-subtitle-jobs-design.md](../specs/2026-10-17-transcribe-translate-subtitle-jobs-design.md).

**Global constraints:**

- VideoCaptioner only (no tencentAsr Core path).
- Do not migrate synthesize/process.
- Snapshots must never include `llm.apiKey` / `apiBase` / `model`.
- Browser must not import `@smm/core` root barrel.
- After each task that changes code: run the listed test/typecheck command before commit.
- Prefer `pnpm --filter @smm/core test -- <file>` / `pnpm --filter ui test -- <file>` style filters used in this repo.

---

## File structure (create / modify)

| Path | Responsibility |
|------|----------------|
| `apps/core/src/ports/VideoCaptionerPort.ts` | Port interface |
| `apps/core/src/whitelistedCmd/videocaptioner.ts` | Argv builders + validation |
| `apps/core/src/whitelistedCmd/videocaptioner.test.ts` | Builder unit tests |
| `apps/core/src/jobs/types.ts` | Snapshot types + `Job` union |
| `apps/core/src/jobs/jobManager.ts` | `videocaptioner` queue |
| `apps/core/src/jobs/TranscribeSubtitleJob.ts` | Job class |
| `apps/core/src/jobs/TranscribeSubtitleJob.test.ts` | Job tests |
| `apps/core/src/jobs/TranslateSubtitleJob.ts` | Job class |
| `apps/core/src/jobs/TranslateSubtitleJob.test.ts` | Job tests |
| `apps/core/src/pipeline/videocaptioner/subtitleJobsApi.ts` | Request assert helpers + request types |
| `apps/core/src/types.ts` | `videoCaptioner?` on PlatformPorts |
| `apps/core/src/Core.ts` | `transcribeSubtitle` / `translateSubtitle` |
| `apps/core/src/index.ts` | Public exports |
| `apps/server/src/core/VideoCaptionerPort.ts` | Host adapter |
| `apps/server/src/core/getCore.ts` | Wire port |
| `apps/server/src/route/TranscribeSubtitle.ts` | HTTP |
| `apps/server/src/route/TranslateSubtitle.ts` | HTTP |
| `apps/server/src/route/serializeJob.ts` | Serialize new kinds |
| `apps/server/app.ts` | `.route()` |
| `apps/cli/src/cli/commands/transcribe.ts` (+ test) | CLI |
| `apps/cli/src/cli/commands/translate.ts` (+ test) | CLI |
| `apps/cli/src/cli/runCli.ts` | Register commands |
| `apps/ui/src/api/transcribeSubtitle.ts` | RPC client |
| `apps/ui/src/api/translateSubtitle.ts` | RPC client |
| `apps/ui/src/types/background-jobs.ts` | New mirror job types |
| `apps/ui/src/components/dialogs/TranscribeDialog.tsx` | Core enqueue |
| `apps/ui/src/components/dialogs/SubtitleTranslationDialog.tsx` | Core enqueue |
| `apps/ui/src/hooks/useJobManager.ts` | stop/remove Core kinds |
| `apps/ui/src/components/JobOrchestratorProvider.tsx` | Remove transcribe/translate |
| `apps/ui/src/lib/transcribeJobFactory.ts` / `translateJobFactory.ts` | Delete if unused |
| `docs/dev/job.md` / `docs/api/index.md` | Docs |

---

### Task 1: `VideoCaptionerPort` + `PlatformPorts`

**Files:**
- Create: `apps/core/src/ports/VideoCaptionerPort.ts`
- Modify: `apps/core/src/types.ts`
- Modify: `apps/core/src/index.ts` (export port types)

- [ ] **Step 1: Add port file**

```ts
// apps/core/src/ports/VideoCaptionerPort.ts
export interface VideoCaptionerRunRequest {
  args: string[];
  onStdoutLine?: (line: string) => void;
  onStderrLine?: (line: string) => void;
}

export interface VideoCaptionerRunResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

export interface VideoCaptionerPort {
  run(request: VideoCaptionerRunRequest, signal: AbortSignal): Promise<VideoCaptionerRunResult>;
}
```

- [ ] **Step 2: Extend PlatformPorts**

In `apps/core/src/types.ts`, add optional `videoCaptioner?: VideoCaptionerPort` to both `PlatformPorts` and `PlatformPortsInput` (mirror `command?: CommandPort`). Import the type.

- [ ] **Step 3: Export from `apps/core/src/index.ts`**

```ts
export type {
  VideoCaptionerPort,
  VideoCaptionerRunRequest,
  VideoCaptionerRunResult,
} from "./ports/VideoCaptionerPort";
```

- [ ] **Step 4: Commit**

```bash
git add apps/core/src/ports/VideoCaptionerPort.ts apps/core/src/types.ts apps/core/src/index.ts
git commit -m "feat(core): add VideoCaptionerPort alongside CommandPort"
```

---

### Task 2: Whitelist argv builders

**Files:**
- Create: `apps/core/src/whitelistedCmd/videocaptioner.ts`
- Create: `apps/core/src/whitelistedCmd/videocaptioner.test.ts`

Move logic from UI `JobOrchestratorProvider` `buildTranscribeArgs` / `buildTranslateArgs` / `ensureVcApiKey`. Keep synthesize/process builders in UI for now.

- [ ] **Step 1: Write failing tests**

```ts
// apps/core/src/whitelistedCmd/videocaptioner.test.ts
import { describe, expect, it } from "vitest";
import {
  buildTranscribeSubtitleArgs,
  buildTranslateSubtitleArgs,
  VIDEOCAPTIONER_DUMMY_API_KEY,
} from "./videocaptioner";

describe("buildTranscribeSubtitleArgs", () => {
  it("builds default bijian/srt argv", () => {
    expect(
      buildTranscribeSubtitleArgs({
        mediaPath: "C:\\media\\a.mp4",
        asr: "bijian",
      }),
    ).toEqual(["transcribe", "C:\\media\\a.mp4", "--asr", "bijian", "--format", "srt"]);
  });

  it("includes language and word-timestamps when set", () => {
    const args = buildTranscribeSubtitleArgs({
      mediaPath: "/m/a.mp4",
      asr: "jianying",
      language: "zh",
      wordTimestamps: true,
      format: "ass",
    });
    expect(args).toContain("--language");
    expect(args).toContain("zh");
    expect(args).toContain("--word-timestamps");
    expect(args).toContain("ass");
  });
});

describe("buildTranslateSubtitleArgs", () => {
  it("adds dummy api-key when llm key absent", () => {
    const args = buildTranslateSubtitleArgs({
      subtitlePath: "/s.srt",
      translator: "bing",
      targetLanguage: "zh-CN",
    });
    expect(args.slice(0, 6)).toEqual([
      "subtitle",
      "/s.srt",
      "--translator",
      "bing",
      "--target-language",
      "zh-CN",
    ]);
    expect(args).toContain("--no-optimize");
    expect(args).toContain("--no-split");
    expect(args).toContain("--api-key");
    expect(args).toContain(VIDEOCAPTIONER_DUMMY_API_KEY);
  });

  it("uses real llm api-key and skips dummy", () => {
    const args = buildTranslateSubtitleArgs({
      subtitlePath: "/s.srt",
      translator: "llm",
      targetLanguage: "en",
      llm: { apiKey: "sk-real", apiBase: "https://api.example", model: "gpt" },
    });
    expect(args).toContain("sk-real");
    expect(args).toContain("--api-base");
    expect(args).not.toContain(VIDEOCAPTIONER_DUMMY_API_KEY);
  });
});
```

- [ ] **Step 2: Run tests — expect FAIL (module missing)**

```bash
pnpm --filter @smm/core exec vitest run src/whitelistedCmd/videocaptioner.test.ts
```

Expected: FAIL cannot find module / export.

- [ ] **Step 3: Implement builders**

```ts
// apps/core/src/whitelistedCmd/videocaptioner.ts
export const VIDEOCAPTIONER_DUMMY_API_KEY = "dummykey";

export type TranscribeAsr = "bijian" | "jianying" | "whisper-cpp";
export type TranscribeFormat = "srt" | "ass" | "txt" | "json";
export type TranslateTranslator = "bing" | "google" | "llm";
export type TranslateLayout =
  | "target-above"
  | "source-above"
  | "target-only"
  | "source-only";

export interface BuildTranscribeSubtitleArgsInput {
  mediaPath: string;
  asr: TranscribeAsr;
  language?: string;
  wordTimestamps?: boolean;
  format?: TranscribeFormat;
}

export interface BuildTranslateSubtitleArgsInput {
  subtitlePath: string;
  translator: TranslateTranslator;
  targetLanguage: string;
  reflect?: boolean;
  layout?: TranslateLayout;
  llm?: { apiKey: string; apiBase?: string; model?: string };
}

function ensureVcApiKey(args: string[]): void {
  if (!args.includes("--api-key")) {
    args.push("--api-key", VIDEOCAPTIONER_DUMMY_API_KEY);
  }
}

export function buildTranscribeSubtitleArgs(
  input: BuildTranscribeSubtitleArgsInput,
): string[] {
  const args: string[] = ["transcribe", input.mediaPath];
  args.push("--asr", input.asr || "bijian");
  if (input.language) args.push("--language", input.language);
  if (input.wordTimestamps === true) args.push("--word-timestamps");
  args.push("--format", input.format || "srt");
  return args;
}

export function buildTranslateSubtitleArgs(
  input: BuildTranslateSubtitleArgsInput,
): string[] {
  const args: string[] = [
    "subtitle",
    input.subtitlePath,
    "--translator",
    input.translator,
    "--target-language",
    input.targetLanguage,
    "--no-optimize",
    "--no-split",
  ];
  if (input.reflect === true) args.push("--reflect");
  if (input.layout) args.push("--layout", input.layout);
  if (input.translator === "llm" && input.llm?.apiKey) {
    args.push("--api-key", input.llm.apiKey);
    if (input.llm.apiBase) args.push("--api-base", input.llm.apiBase);
    if (input.llm.model) args.push("--model", input.llm.model);
  }
  ensureVcApiKey(args);
  return args;
}
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
pnpm --filter @smm/core exec vitest run src/whitelistedCmd/videocaptioner.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add apps/core/src/whitelistedCmd/videocaptioner.ts apps/core/src/whitelistedCmd/videocaptioner.test.ts
git commit -m "feat(core): add videocaptioner argv builders for subtitle jobs"
```

---

### Task 3: JobManager `videocaptioner` queue

**Files:**
- Modify: `apps/core/src/jobs/jobManager.ts`
- Modify: `apps/core/src/jobs/jobManager.test.ts`

- [ ] **Step 1: Extend queue name + lazy PQueue**

```ts
export type JobQueueName = "default" | "ytdlp" | "videocaptioner";
```

Add `_videocaptionerQueue` getter (concurrency 1) mirroring `ytdlpQueue`. Update `queueFor`:

```ts
private queueFor(name: JobQueueName): PQueue {
  if (name === "ytdlp") return this.ytdlpQueue;
  if (name === "videocaptioner") return this.videocaptionerQueue;
  return this.queue;
}
```

- [ ] **Step 2: Add test — videocaptioner does not block default**

Copy the existing `ytdlp queue does not block the default queue` test; rename types/ids to `videocaptioner`. Also add: one slow videocaptioner job blocks a second videocaptioner job until released (concurrency 1).

- [ ] **Step 3: Run**

```bash
pnpm --filter @smm/core exec vitest run src/jobs/jobManager.test.ts
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/core/src/jobs/jobManager.ts apps/core/src/jobs/jobManager.test.ts
git commit -m "feat(core): add videocaptioner JobManager queue (concurrency 1)"
```

---

### Task 4: Snapshot types

**Files:**
- Modify: `apps/core/src/jobs/types.ts`
- Modify: `apps/core/src/index.ts` (re-export new snapshot types)

- [ ] **Step 1: Add snapshot interfaces and extend `Job`**

```ts
export interface TranscribeSubtitleJobSnapshot {
  kind: "transcribe-subtitle";
  id: string;
  type: "transcribe-subtitle";
  folder: string;
  mediaPath: string;
  title?: string;
  asr: string;
  language?: string;
  wordTimestamps?: boolean;
  format?: string;
  status: JobStatus;
  progress: number;
  error?: string;
  createdAt: number;
  updatedAt: number;
}

export interface TranslateSubtitleJobSnapshot {
  kind: "translate-subtitle";
  id: string;
  type: "translate-subtitle";
  folder: string;
  subtitlePath: string;
  mediaPath?: string;
  title?: string;
  translator: string;
  targetLanguage: string;
  reflect?: boolean;
  layout?: string;
  status: JobStatus;
  progress: number;
  error?: string;
  createdAt: number;
  updatedAt: number;
}

export type Job =
  | ImportJob
  | ImportLibraryJob
  | ScrapeJobSnapshot
  | YtdlpJobSnapshot
  | TranscribeSubtitleJobSnapshot
  | TranslateSubtitleJobSnapshot;
```

No `llm` fields on translate snapshot.

- [ ] **Step 2: Commit**

```bash
git add apps/core/src/jobs/types.ts apps/core/src/index.ts
git commit -m "feat(core): add transcribe/translate subtitle job snapshot types"
```

---

### Task 5: `TranscribeSubtitleJob`

**Files:**
- Create: `apps/core/src/jobs/TranscribeSubtitleJob.ts`
- Create: `apps/core/src/jobs/TranscribeSubtitleJob.test.ts`
- Modify: `apps/core/src/index.ts` (export class)

Pattern: copy structure from `YtdlpJob` but use `VideoCaptionerPort`, no cookies, progress stays 0 until AbstractJob `start` sets 100 on success.

- [ ] **Step 1: Write failing tests**

```ts
// Key cases (full file mirrors YtdlpJob.test.ts helpers with videoCaptioner port):
// 1. exit 0 → succeeded; toJSON().kind === "transcribe-subtitle"; progress 100
// 2. Port.run called with buildTranscribeSubtitleArgs shape
// 3. exit 1 → failed; error set from stderr
// 4. abort mid-run → aborted
// 5. missing videoCaptioner port → failed with clear error (or throw caught in run)
```

Use a fake port:

```ts
const videoCaptioner: VideoCaptionerPort = {
  run: vi.fn(async (_req, _signal) => ({ exitCode: 0, stdout: "", stderr: "" })),
};
```

- [ ] **Step 2: Run — expect FAIL**

```bash
pnpm --filter @smm/core exec vitest run src/jobs/TranscribeSubtitleJob.test.ts
```

- [ ] **Step 3: Implement `TranscribeSubtitleJob`**

Essential behavior:

- `type: "transcribe-subtitle"`
- Fields: folder, mediaPath, title?, asr, language?, wordTimestamps?, format?
- `toJSON()` → `TranscribeSubtitleJobSnapshot` (no secrets)
- `run()`: require port → build args → `AbortController` → `port.run` → exit≠0 fail / abort handling like YtdlpJob
- `abort()`: `tryAbort()` + `abortController?.abort()`
- Log stdout/stderr lines via `this.log`
- Do **not** call `setProgress` during run (AbstractJob sets 0 at start / 100 after successful `run` if still `running`)

- [ ] **Step 4: Run — expect PASS**

- [ ] **Step 5: Commit**

```bash
git add apps/core/src/jobs/TranscribeSubtitleJob.ts apps/core/src/jobs/TranscribeSubtitleJob.test.ts apps/core/src/index.ts
git commit -m "feat(core): add TranscribeSubtitleJob"
```

---

### Task 6: `TranslateSubtitleJob`

**Files:**
- Create: `apps/core/src/jobs/TranslateSubtitleJob.ts`
- Create: `apps/core/src/jobs/TranslateSubtitleJob.test.ts`
- Modify: `apps/core/src/index.ts`

- [ ] **Step 1: Failing tests** — same shape as Task 5 plus:

```ts
it("toJSON omits llm credentials", async () => {
  const { job } = createJob({
    translator: "llm",
    llm: { apiKey: "sk-secret", apiBase: "https://x", model: "m" },
  });
  await job.start();
  const snap = job.toJSON();
  expect(JSON.stringify(snap)).not.toContain("sk-secret");
  expect(snap).not.toHaveProperty("llm");
  expect(snap.translator).toBe("llm");
});

it("passes real api key only to Port.run args", async () => {
  const run = vi.fn(async (req) => {
    expect(req.args).toContain("sk-secret");
    return { exitCode: 0, stdout: "", stderr: "" };
  });
  // ...
});
```

- [ ] **Step 2–4: Implement, pass tests, commit**

```bash
git commit -m "feat(core): add TranslateSubtitleJob"
```

---

### Task 7: Core API `transcribeSubtitle` / `translateSubtitle`

**Files:**
- Create: `apps/core/src/pipeline/videocaptioner/subtitleJobsApi.ts`
- Modify: `apps/core/src/Core.ts`
- Modify: `apps/core/src/index.ts`
- Optional test: `apps/core/src/pipeline/videocaptioner/subtitleJobsApi.test.ts`

- [ ] **Step 1: Request types + asserts**

```ts
// apps/core/src/pipeline/videocaptioner/subtitleJobsApi.ts
export interface TranscribeSubtitleRequest {
  folder: string;
  mediaPath: string;
  title?: string;
  asr: "bijian" | "jianying" | "whisper-cpp";
  language?: string;
  wordTimestamps?: boolean;
  format?: "srt" | "ass" | "txt" | "json";
}

export interface TranslateSubtitleRequest {
  folder: string;
  subtitlePath: string;
  mediaPath?: string;
  title?: string;
  translator: "bing" | "google" | "llm";
  targetLanguage: string;
  reflect?: boolean;
  layout?: "target-above" | "source-above" | "target-only" | "source-only";
  llm?: { apiKey: string; apiBase?: string; model?: string };
}

export interface SubtitleJobHandle {
  id: string;
}

export function assertTranscribeSubtitleRequest(req: TranscribeSubtitleRequest): {
  folder: string;
  mediaPath: string;
} {
  const folder = req.folder.trim();
  const mediaPath = req.mediaPath.trim();
  if (!folder) throw new Error("folder is required");
  if (!mediaPath) throw new Error("mediaPath is required");
  if (!req.asr) throw new Error("asr is required");
  return { folder, mediaPath };
}

export function assertTranslateSubtitleRequest(req: TranslateSubtitleRequest): {
  folder: string;
  subtitlePath: string;
  targetLanguage: string;
} {
  const folder = req.folder.trim();
  const subtitlePath = req.subtitlePath.trim();
  const targetLanguage = req.targetLanguage.trim();
  if (!folder) throw new Error("folder is required");
  if (!subtitlePath) throw new Error("subtitlePath is required");
  if (!req.translator) throw new Error("translator is required");
  if (!targetLanguage) throw new Error("targetLanguage is required");
  if (req.translator === "llm" && !req.llm?.apiKey?.trim()) {
    throw new Error("llm.apiKey is required when translator is llm");
  }
  return { folder, subtitlePath, targetLanguage };
}
```

- [ ] **Step 2: Core methods** (mirror `downloadVideo`)

```ts
async transcribeSubtitle(
  request: TranscribeSubtitleRequest,
  callbacks: Callbacks = {},
): Promise<SubtitleJobHandle> {
  const { folder, mediaPath } = assertTranscribeSubtitleRequest(request);
  if (this.platformPorts().videoCaptioner === undefined) {
    throw new Error("VideoCaptionerPort is required for transcribeSubtitle");
  }
  const ctx = this.appContext();
  const ports = this.platformPorts();
  const job = new TranscribeSubtitleJob(ctx, ports, {
    id: nextJobId(),
    logDir: ctx.logDir,
    join: (...parts) => this.fs.join(...parts),
    printLogToConsole: false,
    callbacks,
    folder,
    mediaPath,
    title: request.title,
    asr: request.asr,
    language: request.language,
    wordTimestamps: request.wordTimestamps,
    format: request.format,
  });
  this.jobManager.submit(job, () => {}, {
    queue: "videocaptioner",
    timeoutMs: 10 * 60 * 1000,
  });
  return { id: job.id };
}

// translateSubtitle — same pattern with TranslateSubtitleJob
```

- [ ] **Step 3: Export request types from index**

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(core): enqueue transcribeSubtitle and translateSubtitle on videocaptioner queue"
```

---

### Task 8: Server `VideoCaptionerPort` adapter + getCore wiring

**Files:**
- Create: `apps/server/src/core/VideoCaptionerPort.ts`
- Modify: `apps/server/src/core/getCore.ts`

- [ ] **Step 1: Adapter** (mirror `YtdlpCommandPort`, timeout 10 min, command `videocaptioner`)

```ts
// apps/server/src/core/VideoCaptionerPort.ts
import type {
  VideoCaptionerPort,
  VideoCaptionerRunRequest,
  VideoCaptionerRunResult,
} from '@smm/core'
import { createCommandExecutionLogWriter } from '../route/commandExecutionLog'
import { resolveCommand, runCommand } from '../utils/cmd'

const VC_TIMEOUT_MS = 10 * 60 * 1000

export function createVideoCaptionerPort(): VideoCaptionerPort {
  return {
    async run(request: VideoCaptionerRunRequest, signal: AbortSignal): Promise<VideoCaptionerRunResult> {
      const resolved = await resolveCommand('videocaptioner')
      if (resolved.kind === 'not-found') {
        return { exitCode: 127, stdout: '', stderr: 'videocaptioner executable not found' }
      }
      const cmdLog = await createCommandExecutionLogWriter()
      let stdout = ''
      let stderr = ''
      let exitCode = 1
      await runCommand({
        executablePath: resolved.executablePath,
        command: 'videocaptioner',
        args: request.args,
        tty: false,
        cmdLog,
        timeoutMs: VC_TIMEOUT_MS,
        abortSignal: signal,
        sink: {
          stdout: (line) => {
            stdout += `${line}\n`
            request.onStdoutLine?.(line)
          },
          stderr: (line) => {
            stderr += `${line}\n`
            request.onStderrLine?.(line)
          },
          progress: () => {},
          exit: (code) => {
            exitCode = code
          },
        },
      })
      return { exitCode, stdout, stderr }
    },
  }
}
```

Align `sink` shape with whatever `runCommand` currently requires (copy from `YtdlpCommandPort` carefully — include all required sink keys).

- [ ] **Step 2: Wire in `getCore`**

```ts
import { createVideoCaptionerPort } from './VideoCaptionerPort'
// ports: {
//   ...
//   command: createYtdlpCommandPort(),
//   videoCaptioner: createVideoCaptionerPort(),
//   ...
// }
```

- [ ] **Step 3: Commit**

```bash
git commit -m "feat(server): inject VideoCaptionerPort into Core"
```

---

### Task 9: HTTP routes + serializeJob

**Files:**
- Create: `apps/server/src/route/TranscribeSubtitle.ts`
- Create: `apps/server/src/route/TranslateSubtitle.ts`
- Modify: `apps/server/src/route/serializeJob.ts`
- Modify: `apps/server/app.ts`

- [ ] **Step 1: Routes** — copy `DownloadVideo.ts` pattern:

- `POST /api/transcribe-subtitle` → validate fields → `getCore().transcribeSubtitle(...)` → `{ data: { id } }` or `{ error }`
- `POST /api/translate-subtitle` → same

Required: `folder`, `mediaPath`, `asr` (transcribe); `folder`, `subtitlePath`, `translator`, `targetLanguage` (translate).

- [ ] **Step 2: serializeJob**

```ts
import { TranscribeSubtitleJob, TranslateSubtitleJob, ... } from '@smm/core'
// ...
if (job instanceof TranscribeSubtitleJob) return job.toJSON()
if (job instanceof TranslateSubtitleJob) return job.toJSON()
```

- [ ] **Step 3: Register in `createApp()` after `downloadVideoRoute`**

```ts
.route('/', transcribeSubtitleRoute)
.route('/', translateSubtitleRoute)
```

- [ ] **Step 4: Manual smoke (optional) or unit if repo has route tests — commit**

```bash
git commit -m "feat(server): add transcribe-subtitle and translate-subtitle HTTP routes"
```

---

### Task 10: CLI `smm transcribe` / `smm translate`

**Files:**
- Create: `apps/cli/src/cli/commands/transcribe.ts`
- Create: `apps/cli/src/cli/commands/transcribe.test.ts`
- Create: `apps/cli/src/cli/commands/translate.ts`
- Create: `apps/cli/src/cli/commands/translate.test.ts`
- Modify: `apps/cli/src/cli/runCli.ts`

- [ ] **Step 1: Implement commands** mirroring `download.ts`:

- `getCore({ logger, _ports })` → `core.transcribeSubtitle` / `translateSubtitle`
- `await core.waitForJobUntilCompleted(id)`
- exit 0 if `succeeded`, else 1
- `--verbose` → CliLoggerAdapter + optional onLog
- Support `_ports` with fake `videoCaptioner` in tests

CLI options per design:

```
smm transcribe <media> --folder <path> [--asr bijian] [--language …] [--format srt] [--word-timestamps] [--title …] [-v]
smm translate <subtitle> --folder <path> --translator bing|google|llm --target-language <lang> [--reflect] [--layout …] [--api-key …] [--api-base …] [--model …] [--title …] [--media …] [-v]
```

- [ ] **Step 2: Unit tests with fake VideoCaptionerPort** — exit 0 / exit 1

- [ ] **Step 3: Register in `runCli.ts`**

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(cli): add smm transcribe and smm translate"
```

---

### Task 11: UI API clients + background-job mirror types

**Files:**
- Create: `apps/ui/src/api/transcribeSubtitle.ts`
- Create: `apps/ui/src/api/translateSubtitle.ts`
- Modify: `apps/ui/src/types/background-jobs.ts`
- Modify: `apps/ui/src/hooks/useJobManager.ts`
- Modify: `apps/ui/src/components/hooks/useBackgroundJobsIndicator.ts` (if it special-cases pending ytdlp)

- [ ] **Step 1: API clients** (mirror `apps/ui/src/api/downloadVideo.ts`)

```ts
// transcribeSubtitle.ts — rpc POST /api/transcribe-subtitle, unwrapJson → { id }
// translateSubtitle.ts — same for /api/translate-subtitle
```

- [ ] **Step 2: Add UI types** (new Core-mirrored kinds; keep legacy `transcribe`/`translate` types for IDB history mapping until Task 13 cleanup)

```ts
export interface TranscribeSubtitleBackgroundJob extends BackgroundJobBase {
  type: 'transcribe-subtitle'
  data: {
    folder: string
    mediaPath: string
    title?: string
    asr: string
    language?: string
    wordTimestamps?: boolean
    format?: string
    error?: string
    logRelativePath?: string
  }
}

export interface TranslateSubtitleBackgroundJob extends BackgroundJobBase {
  type: 'translate-subtitle'
  data: {
    folder: string
    subtitlePath: string
    mediaPath?: string
    title?: string
    translator: string
    targetLanguage: string
    reflect?: boolean
    layout?: string
    error?: string
    logRelativePath?: string
  }
}
```

Add to `BackgroundJob` union + `isTranscribeSubtitleBackgroundJob` / `isTranslateSubtitleBackgroundJob` guards.

- [ ] **Step 3: useJobManager** — stop/remove/stopAll treat new types like `ytdlp` (`stopJobViaCore` + store abort/remove). Do **not** send them to Orchestrator.

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(ui): add Core subtitle job API clients and mirror job types"
```

---

### Task 12: Dialogs enqueue via Core + poll

**Files:**
- Modify: `apps/ui/src/components/dialogs/TranscribeDialog.tsx` (+ tests)
- Modify: `apps/ui/src/components/dialogs/SubtitleTranslationDialog.tsx` (+ tests)
- Create (optional helper): `apps/ui/src/components/dialogs/hooks/use-subtitle-core-job-flow.ts` — or inline poll like `use-ytdlp-download-flow` upsert pattern

- [ ] **Step 1: TranscribeDialog**

On confirm (VideoCaptioner only):

1. Resolve platform path: `Path.toPlatformPath(Path.posix(row.path))` as `mediaPath`
2. `POST` via `transcribeSubtitle({ folder, mediaPath, title, asr, language?, wordTimestamps?, format? })`
3. Upsert Zustand job `type: 'transcribe-subtitle'` status pending
4. Start poll loop (`getJob` / existing helper) updating status/progress/error until terminal
5. If provider is `tencentAsr`: toast error / return early (do not call Core; do not createJob)

Hide or disable tencentAsr in dialog when feature flag off (already mostly gated); when flag on, still block Confirm with toast “Tencent ASR is not available in this version”.

- [ ] **Step 2: SubtitleTranslationDialog** — same with `translateSubtitle`; never put `llm` into Zustand `data`.

- [ ] **Step 3: Update dialog tests** — mock API; assert no `createJob` / factory calls for happy path.

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(ui): enqueue transcribe/translate via Core HTTP"
```

---

### Task 13: Orchestrator teardown + MusicPanel / row status

**Files:**
- Modify: `apps/ui/src/components/JobOrchestratorProvider.tsx`
- Delete (if unused): `apps/ui/src/lib/transcribeJobFactory.ts`, `translateJobFactory.ts` (+ their tests)
- Modify: MusicPanel / helpers that filter `type === 'transcribe'|'translate'` to also (or instead) include `transcribe-subtitle` / `translate-subtitle`
- Modify: `jobRecordMapper` / `reconcileJobRecordWithCommandStatus` — stop expecting Orchestrator to run new Core kinds; leave legacy IDB mapping read-only or map to removable-only

- [ ] **Step 1: Remove** `buildTranscribeArgs`, `buildTranslateArgs`, `case 'transcribe'`, `case 'translate'`, and timeout keys for those types. Keep `ensureVcApiKey` + synthesize/process builders.

- [ ] **Step 2: Grep for `buildTranscribeJob` / `buildTranslateJob` / `type: 'transcribe'` create paths — remove dead create paths.

- [ ] **Step 3: Update MusicPanel row busy/status** to read Core-mirrored jobs by `mediaPath` / `subtitlePath`.

- [ ] **Step 4: Run UI tests for Orchestrator / TranscribeDialog / MusicPanel**

```bash
pnpm --filter ui exec vitest run src/components/dialogs/TranscribeDialog.test.tsx
# plus Orchestrator / MusicPanel tests that fail after edits
```

- [ ] **Step 5: Commit**

```bash
git commit -m "refactor(ui): remove Orchestrator transcribe/translate; use Core jobs"
```

---

### Task 14: Docs

**Files:**
- Modify: `docs/dev/job.md`
- Modify: `docs/api/index.md`

- [ ] **Step 1: job.md** — add `videocaptioner` queue row; document `transcribeSubtitle` / `translateSubtitle`; note UI polls Core snapshots; CLI `smm transcribe` / `smm translate`.

- [ ] **Step 2: api/index.md** — document both POST routes (request fields + `{ data: { id } }`).

- [ ] **Step 3: Commit**

```bash
git commit -m "docs: document subtitle Core jobs, queue, and HTTP/CLI"
```

---

### Task 15: Verification gate

- [ ] **Step 1: Run**

```bash
pnpm --filter @smm/core exec vitest run src/whitelistedCmd/videocaptioner.test.ts src/jobs/TranscribeSubtitleJob.test.ts src/jobs/TranslateSubtitleJob.test.ts src/jobs/jobManager.test.ts
pnpm --filter @smm/cli test -- transcribe translate
pnpm typecheck
pnpm --filter ui exec vitest run src/components/dialogs/TranscribeDialog.test.tsx
```

Fix failures.

- [ ] **Step 2: Optional knip on touched packages if precommit requires it**

```bash
pnpm knip
```

- [ ] **Step 3: Final commit only if verification produced fixes**

---

## Spec coverage checklist (self-review)

| Spec requirement | Task |
|------------------|------|
| VideoCaptionerPort | 1, 8 |
| Argv whitelist from Orchestrator | 2 |
| videocaptioner queue concurrency 1 / 10 min | 3, 7 |
| Dual jobs + snapshots without llm secrets | 4–6 |
| Core + HTTP enqueue | 7, 9 |
| CLI wait exit 0/1 | 10 |
| UI dialogs + Zustand mirror + stop | 11–12 |
| Orchestrator remove transcribe/translate; keep synthesize/process | 13 |
| tencentAsr blocked | 12 |
| Docs job.md + api | 14 |
| Tests Core/HTTP/UI/CLI | 5–6, 10, 12, 15 |

No TBD placeholders. Types (`transcribe-subtitle` / `translate-subtitle`) consistent across Core, HTTP, UI, CLI.
`)