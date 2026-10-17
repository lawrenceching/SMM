# SynthesizeSubtitleJob + ProcessSubtitleJob Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move synthesize and process subtitle jobs from UI IndexedDB/Orchestrator onto Core (`SynthesizeSubtitleJob` / `ProcessSubtitleJob`), reusing `VideoCaptionerPort` and the shared `videocaptioner` queue, with HTTP, CLI, and UI mirroring.

**Architecture:** Mirror the landed transcribe/translate pattern. Core owns argv (existing builders) and job lifecycle; JobManager submit uses `queue: "videocaptioner"` with timeout 1h / 2h; server Port timeout raised to ≥2h; UI dialogs POST + Zustand poll; Orchestrator keeps only ffmpeg.

**Tech Stack:** TypeScript, Vitest, Bun/Hono, React 19, Zustand, Commander. Spec: [2026-10-18-synthesize-process-subtitle-jobs-design.md](../specs/2026-10-18-synthesize-process-subtitle-jobs-design.md). Prior art: [2026-10-18-transcribe-translate-subtitle-jobs.md](./2026-10-18-transcribe-translate-subtitle-jobs.md).

**Global constraints:**

- Reuse `VideoCaptionerPort` and shared `videocaptioner` queue (do not add a second VC queue).
- Process = one Job calling VC `process` (do not chain Core jobs).
- Snapshots / Zustand must never include `llm` credentials.
- Leave ffmpeg Orchestrator paths alone.
- Browser must not import `@smm/core` root barrel.
- Prefer copying patterns from `TranscribeSubtitleJob` / `TranslateSubtitleJob` / `pollSubtitleJob` / `transcribe.ts` CLI.

---

## File structure

| Path | Responsibility |
|------|----------------|
| `apps/core/src/jobs/types.ts` | Snapshot types + `Job` union |
| `apps/core/src/jobs/SynthesizeSubtitleJob.ts` (+ test) | Job |
| `apps/core/src/jobs/ProcessSubtitleJob.ts` (+ test) | Job |
| `apps/core/src/pipeline/videocaptioner/subtitleJobsApi.ts` | Extend with synthesize/process request + asserts |
| `apps/core/src/Core.ts` / `index.ts` | Public API + exports |
| `apps/server/src/core/VideoCaptionerPort.ts` | Timeout ≥ 2h |
| `apps/server/src/route/SynthesizeSubtitle.ts` | HTTP |
| `apps/server/src/route/ProcessSubtitle.ts` | HTTP |
| `apps/server/src/route/serializeJob.ts` / `app.ts` | Wire |
| `apps/cli/.../synthesize.ts` / `process.ts` (+ tests) | CLI |
| `apps/ui/src/api/synthesizeSubtitle.ts` / `processSubtitle.ts` | RPC |
| `apps/ui/src/types/background-jobs.ts` | Mirror types |
| `apps/ui/src/lib/pollSubtitleJob.ts` | Extend kinds + upserts |
| `apps/ui/.../SynthesizeSubtitleDialog.tsx` / `ProcessPipelineDialog.tsx` | Core enqueue |
| `apps/ui/.../JobOrchestratorProvider.tsx` | Remove synthesize/process execution |
| `apps/ui/src/lib/synthesizeJobFactory.ts` / `processJobFactory.ts` | Delete if unused |
| `docs/dev/job.md` / `docs/api/index.md` | Docs |

---

### Task 1: Snapshot types

**Files:**
- Modify: `apps/core/src/jobs/types.ts`
- Modify: `apps/core/src/index.ts`

- [ ] **Step 1: Add snapshots after existing subtitle snapshots**

```ts
export interface SynthesizeSubtitleJobSnapshot {
  kind: "synthesize-subtitle";
  id: string;
  type: "synthesize-subtitle";
  folder: string;
  videoPath: string;
  subtitlePath: string;
  title?: string;
  subtitleMode?: string;
  quality?: string;
  style?: string;
  renderMode?: string;
  layout?: string;
  status: JobStatus;
  progress: number;
  error?: string;
  createdAt: number;
  updatedAt: number;
}

export interface ProcessSubtitleJobSnapshot {
  kind: "process-subtitle";
  id: string;
  type: "process-subtitle";
  folder: string;
  mediaPath: string;
  title?: string;
  asr?: string;
  language?: string;
  wordTimestamps?: boolean;
  format?: string;
  noOptimize?: boolean;
  noSplit?: boolean;
  noTranslate?: boolean;
  translator?: string;
  targetLanguage?: string;
  reflect?: boolean;
  layout?: string;
  prompt?: string;
  noSynthesize?: boolean;
  subtitleMode?: string;
  quality?: string;
  style?: string;
  renderMode?: string;
  synthesizeLayout?: string;
  status: JobStatus;
  progress: number;
  error?: string;
  createdAt: number;
  updatedAt: number;
}
```

Extend `Job` union. **No `llm` on process snapshot.** Re-export from `index.ts`.

- [ ] **Step 2: Commit**

```bash
git commit -m "feat(core): add synthesize/process subtitle job snapshot types"
```

---

### Task 2: `SynthesizeSubtitleJob`

**Files:**
- Create: `apps/core/src/jobs/SynthesizeSubtitleJob.ts`
- Create: `apps/core/src/jobs/SynthesizeSubtitleJob.test.ts`
- Modify: `apps/core/src/index.ts`

Pattern: copy `TranscribeSubtitleJob.ts` structure.

- [ ] **Step 1: Failing tests** — exit 0 → succeeded + kind + progress 100; Port.run args match `buildVideoCaptionerSynthesizeArgs`; exit 1 → failed; abort → aborted; missing port → failed.

- [ ] **Step 2: Implement** — `type: "synthesize-subtitle"`; fields folder/videoPath/subtitlePath/title?/subtitleMode?/quality?/style?/renderMode?/layout?; `run()` uses `buildVideoCaptionerSynthesizeArgs({ videoPath, subtitlePath, ... })`; abort via AbortController.

- [ ] **Step 3: Green + commit**

```bash
pnpm --filter @smm/core exec vitest run src/jobs/SynthesizeSubtitleJob.test.ts
git commit -m "feat(core): add SynthesizeSubtitleJob"
```

---

### Task 3: `ProcessSubtitleJob`

**Files:**
- Create: `apps/core/src/jobs/ProcessSubtitleJob.ts`
- Create: `apps/core/src/jobs/ProcessSubtitleJob.test.ts`
- Modify: `apps/core/src/index.ts`

- [ ] **Step 1: Failing tests** — same lifecycle as Task 2, plus:

```ts
it("toJSON omits llm credentials", async () => { /* llm in options; JSON has no llm/sk-secret */ });
it("passes api key only to Port.run args", async () => { /* args contain sk-secret */ });
```

- [ ] **Step 2: Implement** — keep `llm` private; argv via:

```ts
buildVideoCaptionerProcessArgs(
  this.mediaPath,
  processJobDataToCliOptions({
    asr: this.asr,
    language: this.language,
    // ... all flat process fields including llm
  }),
);
```

- [ ] **Step 3: Green + commit**

```bash
git commit -m "feat(core): add ProcessSubtitleJob"
```

---

### Task 4: Core API `synthesizeSubtitle` / `processSubtitle`

**Files:**
- Modify: `apps/core/src/pipeline/videocaptioner/subtitleJobsApi.ts` (+ tests)
- Modify: `apps/core/src/Core.ts`
- Modify: `apps/core/src/index.ts`

- [ ] **Step 1: Request types + asserts**

```ts
export interface SynthesizeSubtitleRequest {
  folder: string;
  videoPath: string;
  subtitlePath: string;
  title?: string;
  subtitleMode?: "soft" | "hard";
  quality?: "ultra" | "high" | "medium" | "low";
  style?: string;
  renderMode?: "ass" | "rounded";
  layout?: "target-above" | "source-above" | "target-only" | "source-only";
}

export interface ProcessSubtitleRequest {
  folder: string;
  mediaPath: string;
  title?: string;
  asr?: "bijian" | "jianying" | "whisper-cpp";
  language?: string;
  wordTimestamps?: boolean;
  format?: "srt" | "ass" | "txt" | "json";
  noOptimize?: boolean;
  noSplit?: boolean;
  noTranslate?: boolean;
  translator?: "bing" | "google" | "llm";
  targetLanguage?: string;
  reflect?: boolean;
  layout?: "target-above" | "source-above" | "target-only" | "source-only";
  prompt?: string;
  llm?: { apiKey: string; apiBase?: string; model?: string };
  noSynthesize?: boolean;
  subtitleMode?: "soft" | "hard";
  quality?: "ultra" | "high" | "medium" | "low";
  style?: string;
  renderMode?: "ass" | "rounded";
  synthesizeLayout?: "target-above" | "source-above" | "target-only" | "source-only";
}

export function assertSynthesizeSubtitleRequest(req: SynthesizeSubtitleRequest): {
  folder: string; videoPath: string; subtitlePath: string;
} { /* trim; require folder, videoPath, subtitlePath */ }

export function assertProcessSubtitleRequest(req: ProcessSubtitleRequest): {
  folder: string; mediaPath: string;
} {
  // trim folder/mediaPath required
  // if translator === "llm" (and not noTranslate), require llm.apiKey
  // if translating (not noTranslate) and translator set, require targetLanguage
}
```

- [ ] **Step 2: Core methods** (mirror `transcribeSubtitle`)

```ts
// synthesizeSubtitle → new SynthesizeSubtitleJob → submit({ queue: "videocaptioner", timeoutMs: 60 * 60 * 1000 })
// processSubtitle → new ProcessSubtitleJob → submit({ queue: "videocaptioner", timeoutMs: 2 * 60 * 60 * 1000 })
```

Require `videoCaptioner` port.

- [ ] **Step 3: Export + commit**

```bash
git commit -m "feat(core): enqueue synthesizeSubtitle and processSubtitle on videocaptioner queue"
```

---

### Task 5: Raise Server `VideoCaptionerPort` timeout

**Files:**
- Modify: `apps/server/src/core/VideoCaptionerPort.ts`

- [ ] **Step 1: Change constant**

```ts
// was: 10 * 60 * 1000
const VIDEOCAPTIONER_TIMEOUT_MS = 2 * 60 * 60 * 1000
```

Update the file comment to note it covers process (2h) as the longest VC job.

- [ ] **Step 2: Commit**

```bash
git commit -m "fix(server): raise VideoCaptionerPort timeout to 2h for process jobs"
```

---

### Task 6: HTTP routes + serializeJob

**Files:**
- Create: `apps/server/src/route/SynthesizeSubtitle.ts`
- Create: `apps/server/src/route/ProcessSubtitle.ts`
- Modify: `apps/server/src/route/serializeJob.ts`
- Modify: `apps/server/app.ts`

- [ ] **Step 1: Routes** — copy `TranscribeSubtitle.ts` / `TranslateSubtitle.ts` patterns:
  - `POST /api/synthesize-subtitle` — require folder, videoPath, subtitlePath
  - `POST /api/process-subtitle` — require folder, mediaPath; optional llm object when apiKey present

- [ ] **Step 2: serializeJob** — `instanceof SynthesizeSubtitleJob` / `ProcessSubtitleJob` → `toJSON()`

- [ ] **Step 3: Mount in `createApp()` after translate-subtitle routes**

- [ ] **Step 4: `pnpm --filter server typecheck` + commit**

```bash
git commit -m "feat(server): add synthesize-subtitle and process-subtitle HTTP routes"
```

---

### Task 7: CLI `smm synthesize` / `smm process`

**Files:**
- Create: `apps/cli/src/cli/commands/synthesize.ts` (+ `.test.ts`)
- Create: `apps/cli/src/cli/commands/process.ts` (+ `.test.ts`) — name carefully vs Node `process`; file can be `processSubtitle.ts` exporting `processSubtitle` if `process` conflicts
- Modify: `apps/cli/src/cli/runCli.ts`

- [ ] **Step 1: Implement** mirroring `transcribe.ts` / `translate.ts`:
  - getCore + waitForJobUntilCompleted + exit 0/1
  - `_ports.videoCaptioner` for tests
  - Commander: `synthesize <video> -s/--subtitle <path> --folder ...`
  - Commander: `process <media> --folder ...` with flags from design

Prefer command function name `runProcessSubtitle` / file `processSubtitle.ts` if `process` shadows Node global in modules.

- [ ] **Step 2: Tests** — fake Port exit 0 → CLI 0; exit 1 → CLI 1; assert `videoCaptioner.run` called on both paths

- [ ] **Step 3: Register in runCli + commit**

```bash
git commit -m "feat(cli): add smm synthesize and smm process"
```

---

### Task 8: UI API + mirror types + job manager

**Files:**
- Create: `apps/ui/src/api/synthesizeSubtitle.ts`
- Create: `apps/ui/src/api/processSubtitle.ts`
- Modify: `apps/ui/src/types/background-jobs.ts`
- Modify: `apps/ui/src/hooks/useJobManager.ts`
- Modify: `apps/ui/src/components/hooks/useBackgroundJobsIndicator.ts`
- Modify: `apps/ui/src/api/getJob.ts` — extend `Job` Extract union for new kinds
- Modify: `apps/ui/src/lib/pollSubtitleJob.ts` — extend `SubtitleCoreJobKind` + upsert helpers

- [ ] **Step 1: API clients** — `synthesizeSubtitleViaCore` / `processSubtitleViaCore` (mirror download/transcribe clients)

- [ ] **Step 2: Types**

```ts
type: 'synthesize-subtitle' | 'process-subtitle'
// data: non-secret fields only; process data has NO llm
```

Guards + add to `BackgroundJob` union. Keep legacy `synthesize` / `process` types.

- [ ] **Step 3: useJobManager / indicator** — treat new types as Core-mirrored (same helper as ytdlp/transcribe-subtitle)

- [ ] **Step 4: pollSubtitleJob** — extend kind union; add `upsertSynthesizeSubtitleJobFromCore` / `upsertProcessSubtitleJobFromCore` / apply poll updates

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(ui): add Core synthesize/process job API clients and mirror types"
```

---

### Task 9: Dialogs enqueue via Core

**Files:**
- Modify: `apps/ui/src/components/dialogs/SynthesizeSubtitleDialog.tsx` (+ tests)
- Modify: `apps/ui/src/components/dialogs/ProcessPipelineDialog.tsx` (+ tests)

- [ ] **Step 1: SynthesizeSubtitleDialog** — platform paths via `Path`; `synthesizeSubtitleViaCore`; upsert + `pollSubtitleJob(id, 'synthesize-subtitle', ...)`; remove `buildSynthesizeJob` / `createJob`

- [ ] **Step 2: ProcessPipelineDialog** — same with `processSubtitleViaCore`; pass `llm` only to API; never into Zustand

- [ ] **Step 3: Update/add dialog tests** — mock ViaCore; assert no createJob on happy path

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(ui): enqueue synthesize/process via Core HTTP"
```

---

### Task 10: Orchestrator teardown + row status

**Files:**
- Modify: `apps/ui/src/components/JobOrchestratorProvider.tsx`
- Delete if unused: `synthesizeJobFactory.ts`, `processJobFactory.ts` (+ tests)
- Modify: `useMusicFolderSubtitlePipeline` / `LocalFileTableRow` (or equivalents) for Core kinds
- Leave jobRecordMapper legacy mapping read-only

- [ ] **Step 1: Remove** `buildSynthesizeArgs` / `buildProcessArgs` / timeout keys; replace cases with fail-fast stubs (like transcribe) **or** delete cases if default-safe — prefer fail-fast stubs for pending IDB rows

- [ ] **Step 2: Keep** ffmpeg cases and `ensureVcApiKey` only if still needed by ffmpeg path (if unused after removal, delete ensureVcApiKey too)

- [ ] **Step 3: Row busy status** includes `synthesize-subtitle` / `process-subtitle`

- [ ] **Step 4: Run UI tests** for dialogs + pipeline + Orchestrator-related

- [ ] **Step 5: Commit**

```bash
git commit -m "refactor(ui): remove Orchestrator synthesize/process; use Core jobs"
```

---

### Task 11: Docs

**Files:**
- Modify: `docs/dev/job.md`
- Modify: `docs/api/index.md`

- [ ] Document new kinds, timeouts (1h / 2h), Port ≥2h note, CLI, HTTP routes

- [ ] Commit

```bash
git commit -m "docs: document synthesize/process Core jobs, queue timeouts, and HTTP/CLI"
```

---

### Task 12: Verification gate

- [ ] Run:

```bash
pnpm --filter @smm/core exec vitest run \
  src/jobs/SynthesizeSubtitleJob.test.ts \
  src/jobs/ProcessSubtitleJob.test.ts \
  src/pipeline/videocaptioner/subtitleJobsApi.test.ts \
  src/jobs/jobManager.test.ts

cd apps/cli && pnpm exec vitest run src/cli/commands/synthesize.test.ts src/cli/commands/processSubtitle.test.ts
# (adjust filenames to match Task 7)

pnpm --filter @smm/core exec tsc --noEmit
pnpm --filter server typecheck
pnpm --filter ui typecheck

pnpm --filter ui exec vitest run \
  src/components/dialogs/SynthesizeSubtitleDialog.test.tsx \
  src/components/dialogs/ProcessPipelineDialog.test.tsx
```

- [ ] Fix failures; commit only if fixes needed

---

## Spec coverage checklist

| Spec requirement | Task |
|------------------|------|
| SynthesizeSubtitleJob / ProcessSubtitleJob | 2–3 |
| Shared videocaptioner queue; timeouts 1h/2h | 4 |
| Port timeout ≥ 2h | 5 |
| Core + HTTP enqueue | 4, 6 |
| CLI wait exit 0/1 | 7 |
| UI dialogs + Zustand + stop | 8–9 |
| Orchestrator remove synthesize/process; keep ffmpeg | 10 |
| Snapshots/UI omit llm | 1, 3, 8–9 |
| Docs | 11 |
| Tests | 2–3, 7, 9, 12 |

No TBD placeholders. Kind strings consistent: `synthesize-subtitle` / `process-subtitle`.
`)