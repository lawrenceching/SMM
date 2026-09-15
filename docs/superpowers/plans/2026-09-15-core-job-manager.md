# Core JobManager + ImportJob Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace in-memory `JobStore` with `JobManager` + `JobHandle` (create, stop, append/read logs) and run ImportJob through that interface.

**Architecture:** `JobManager` owns job snapshots, log lines, and an abort flag. `create()` returns a `JobHandle`. Import pipeline checks `throwIfAborted` at stage boundaries and dual-writes user logs via `appendLog` plus process logs via `LoggerPort`. HTTP `POST /api/stop-job` and `POST /api/get-job-log`, plus CLI `smm job log` / `smm job stop`, call Core. Scrape and import-library keep using `create`/`update`/`get` and are not abortable.

**Tech Stack:** TypeScript 5, Vitest 4, Hono, Commander, `@smm/core`.

**Spec:** [docs/superpowers/specs/2026-09-15-core-job-manager-design.md](../specs/2026-09-15-core-job-manager-design.md)

## Global Constraints

- Scope: Core JobManager + ImportJob 流水线；HTTP `stop-job` / `get-job-log`；CLI `smm job log` / `smm job stop`.
- Storage: 进程内内存。进程退出即丢。
- Logs: 双写。Job `appendLog` 是用户可见日志；`LoggerPort` 仍打进程日志。`getJob` 快照不含 logs。
- Abort: 协作式，只在阶段边界 `throwIfAborted`。进行中的 TMDB/TVDB 请求会跑完当前调用。
- `stopJob` 本轮只对 `kind === "import"` 且 `pending` / `running` 生效。
- CLI `smm job*` 走本进程 Core。本轮不做 CLI 连 daemon。
- Do **not** modify `apps/ui/**` or `packages/core-routes/**`.
- Do **not** persist jobs, wire External Command Jobs, or make scrape / import-library abortable.
- HTTP status 200 with `{ data, error }`. Error strings are `Error Reason: …`.
- Exact Core error messages: `Job not found`, `Job is not abortable`, `Job already finished`.
- Abort job `error` field is the string `aborted`.
- User-visible import log messages (exact): `persisted folder`, `skipped init`, `recognizing folder`, `recognized "TITLE"`, `recognition completed, no title`, `recognizing episodes`, `recognized episodes`, `succeeded`, `aborted`. Stage 1 failure uses the exception `message` at level `error`.
- Log then transition: `appendLog` / `update` after a terminal status are no-ops, so write the log line **before** setting `succeeded` / `failed` / `aborted`.
- Delete `JobStore`; only `JobManager` stores jobs.

## File Structure

| File | Responsibility |
|------|----------------|
| `apps/core/src/jobs/types.ts` | Add `JobLogLevel` / `JobLogLine` |
| `apps/core/src/jobs/jobAbortError.ts` | `JobAbortError` thrown by `throwIfAborted` |
| `apps/core/src/jobs/jobHandle.ts` | `JobHandle` interface |
| `apps/core/src/jobs/jobManager.ts` | Replaces `jobStore.ts` |
| `apps/core/src/jobs/jobManager.test.ts` | Replaces `jobStore.test.ts` |
| `apps/core/src/jobs/jobStore.ts` | Delete after JobManager is wired |
| `apps/core/src/jobs/jobStore.test.ts` | Delete after tests move |
| `apps/core/src/Core.ts` | `JobManager`; `stopJob` / `getJobLog`; import uses Handle |
| `apps/core/src/pipeline/importFolderPipeline.ts` | Stage-boundary abort + user logs |
| `apps/core/src/index.ts` | Export new types |
| `apps/cli/src/route/StopJob.ts` | `POST /api/stop-job` |
| `apps/cli/src/route/GetJobLog.ts` | `POST /api/get-job-log` |
| `apps/cli/server.ts` | Register the two routes |
| `apps/cli/src/cli/runCli.ts` | `smm job log` / `smm job stop` |
| `docs/api/index.md` | Document the two HTTP APIs |

---

### Task 1: JobManager (types, handle, logs, abort flag)

**Files:**
- Create: `apps/core/src/jobs/jobAbortError.ts`
- Create: `apps/core/src/jobs/jobHandle.ts`
- Create: `apps/core/src/jobs/jobManager.ts`
- Create: `apps/core/src/jobs/jobManager.test.ts`
- Modify: `apps/core/src/jobs/types.ts` (append log types at end of file)
- Modify: `apps/core/src/index.ts` (export new types; keep existing job type exports)
- Delete after green: `apps/core/src/jobs/jobStore.ts`, `apps/core/src/jobs/jobStore.test.ts` — **not in this task**. Core still imports JobStore until Task 2.

**Interfaces:**
- Consumes: existing `ImportJob` / `ImportLibraryJob` / `ScrapeJob` / `Job` / `JobStatus` in `apps/core/src/jobs/types.ts`
- Produces:
  - `export type JobLogLevel = "info" | "warn" | "error"`
  - `export interface JobLogLine { ts: number; level: JobLogLevel; message: string }`
  - `export class JobAbortError extends Error` (`name === "JobAbortError"`, default message `"aborted"`)
  - `export interface JobHandle { readonly id: string; appendLog(level: JobLogLevel, message: string): void; requestStop(): void; throwIfAborted(): void; update(patch: Partial<ImportJob> | Partial<ImportLibraryJob> | Partial<ScrapeJob>): void }`
  - `export function nextJobId(): string` (same algorithm as today's JobStore)
  - `export class JobManager` with `create(init): JobHandle` (same three overloads as JobStore but return `JobHandle`), `update(id, patch)`, `get(id): Job | undefined`, `getLog(id): JobLogLine[] | undefined`, `requestStop(id): void`

- [ ] **Step 1: Write the failing JobManager tests**

Create `apps/core/src/jobs/jobManager.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { JobAbortError } from "./jobAbortError";
import { JobManager } from "./jobManager";

function createImport(manager: JobManager) {
  return manager.create({
    kind: "import",
    folderPath: "/m/My.Show",
    type: "tvshow",
    status: "running",
    stage: "persistFolder",
    progress: 0,
  });
}

describe("JobManager", () => {
  it("creates a job with id and timestamps", () => {
    const manager = new JobManager();
    const handle = createImport(manager);

    expect(handle.id).toBeTruthy();
    const stored = manager.get(handle.id);
    expect(stored?.kind).toBe("import");
    expect(stored?.kind === "import" && stored.folderPath).toBe("/m/My.Show");
    expect(stored?.createdAt).toBeGreaterThan(0);
    expect(stored?.updatedAt).toBeGreaterThanOrEqual(stored!.createdAt);
  });

  it("update patches fields and bumps updatedAt", async () => {
    const manager = new JobManager();
    const handle = manager.create({
      kind: "import",
      folderPath: "/m",
      type: "movie",
      status: "running",
      stage: null,
      progress: 0,
    });
    const firstUpdatedAt = manager.get(handle.id)!.updatedAt;

    await new Promise((r) => setTimeout(r, 5));
    handle.update({ status: "succeeded", stage: null, progress: 100 });

    const updated = manager.get(handle.id);
    expect(updated?.status).toBe("succeeded");
    expect(updated?.kind === "import" && updated.progress).toBe(100);
    expect(updated?.updatedAt).toBeGreaterThan(firstUpdatedAt);
  });

  it("update on unknown id is a no-op", () => {
    const manager = new JobManager();
    expect(() => manager.update("nope", { status: "failed" })).not.toThrow();
  });

  it("get returns a snapshot (mutating it does not affect the store)", () => {
    const manager = new JobManager();
    const handle = manager.create({
      kind: "import",
      folderPath: "/m",
      type: "music",
      status: "running",
      stage: null,
      progress: 0,
    });
    const snapshot = manager.get(handle.id);
    snapshot!.status = "failed";
    expect(manager.get(handle.id)?.status).toBe("running");
  });

  it("appendLog is readable via getLog and is not on the get() snapshot", () => {
    const manager = new JobManager();
    const handle = createImport(manager);
    handle.appendLog("info", "persisted folder");
    const lines = manager.getLog(handle.id);
    expect(lines).toEqual([
      expect.objectContaining({ level: "info", message: "persisted folder" }),
    ]);
    expect(lines![0]!.ts).toBeGreaterThan(0);
    expect(manager.get(handle.id) as { logs?: unknown }).not.toHaveProperty("logs");
  });

  it("getLog returns a copy", () => {
    const manager = new JobManager();
    const handle = createImport(manager);
    handle.appendLog("info", "a");
    const lines = manager.getLog(handle.id)!;
    lines.push({ ts: 1, level: "error", message: "injected" });
    expect(manager.getLog(handle.id)).toHaveLength(1);
  });

  it("requestStop then throwIfAborted throws JobAbortError", () => {
    const manager = new JobManager();
    const handle = createImport(manager);
    handle.requestStop();
    expect(() => handle.throwIfAborted()).toThrow(JobAbortError);
  });

  it("throwIfAborted is a no-op before requestStop", () => {
    const manager = new JobManager();
    const handle = createImport(manager);
    expect(() => handle.throwIfAborted()).not.toThrow();
  });

  it("ignores appendLog and update after a terminal status", () => {
    const manager = new JobManager();
    const handle = createImport(manager);
    handle.appendLog("info", "before");
    handle.update({ status: "succeeded", progress: 100 });
    handle.appendLog("info", "after");
    handle.update({ status: "failed", error: "nope" });
    const job = manager.get(handle.id);
    expect(job?.status).toBe("succeeded");
    expect(job?.error).toBeUndefined();
    expect(manager.getLog(handle.id)?.map((l) => l.message)).toEqual(["before"]);
  });

  it("getLog returns undefined for unknown id", () => {
    expect(new JobManager().getLog("missing")).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @smm/core test -- src/jobs/jobManager.test.ts`

Expected: FAIL (module `./jobManager` not found, or `JobManager` is not defined).

- [ ] **Step 3: Add types + JobAbortError + JobHandle + JobManager**

Append to `apps/core/src/jobs/types.ts`:

```ts
export type JobLogLevel = "info" | "warn" | "error";

export interface JobLogLine {
  ts: number;
  level: JobLogLevel;
  message: string;
}
```

Create `apps/core/src/jobs/jobAbortError.ts`:

```ts
export class JobAbortError extends Error {
  constructor(message = "aborted") {
    super(message);
    this.name = "JobAbortError";
  }
}
```

Create `apps/core/src/jobs/jobHandle.ts`:

```ts
import type { ImportJob, ImportLibraryJob, JobLogLevel, ScrapeJob } from "./types";

export interface JobHandle {
  readonly id: string;
  appendLog(level: JobLogLevel, message: string): void;
  requestStop(): void;
  throwIfAborted(): void;
  update(patch: Partial<ImportJob> | Partial<ImportLibraryJob> | Partial<ScrapeJob>): void;
}
```

Create `apps/core/src/jobs/jobManager.ts`. Keep `nextJobId` identical to `jobStore.ts`. `create` must return `JobHandle`, not `Job`. Internal record: `{ job: Job; logs: JobLogLine[]; abortRequested: boolean }`. `get` still `structuredClone`s **only** `job`. Terminal statuses: `succeeded` | `failed` | `aborted`. If terminal, `appendLog` and `update` return without changes (do not bump `updatedAt`). `requestStop` sets `abortRequested` even when running/pending; it does not change `status`. `throwIfAborted` throws `new JobAbortError()` when `abortRequested` is true.

```ts
import { JobAbortError } from "./jobAbortError";
import type { JobHandle } from "./jobHandle";
import type {
  ImportJob,
  ImportLibraryJob,
  Job,
  JobLogLevel,
  JobLogLine,
  JobStatus,
  ScrapeJob,
} from "./types";

let seq = 0;

/** Runtime-agnostic id: base-36 timestamp + monotonic counter. */
export function nextJobId(): string {
  return `${Date.now().toString(36)}-${(seq++).toString(36)}`;
}

type ImportJobInit = Omit<ImportJob, "id" | "createdAt" | "updatedAt">;
type ImportLibraryJobInit = Omit<ImportLibraryJob, "id" | "createdAt" | "updatedAt">;
type ScrapeJobInit = Omit<ScrapeJob, "id" | "createdAt" | "updatedAt">;
type JobInit = ImportJobInit | ImportLibraryJobInit | ScrapeJobInit;
type JobPatch = Partial<ImportJob> | Partial<ImportLibraryJob> | Partial<ScrapeJob>;

function isTerminal(status: JobStatus): boolean {
  return status === "succeeded" || status === "failed" || status === "aborted";
}

interface JobRecord {
  job: Job;
  logs: JobLogLine[];
  abortRequested: boolean;
}

class JobHandleImpl implements JobHandle {
  constructor(
    readonly id: string,
    private readonly manager: JobManager,
  ) {}

  appendLog(level: JobLogLevel, message: string): void {
    this.manager.appendLog(this.id, level, message);
  }

  requestStop(): void {
    this.manager.requestStop(this.id);
  }

  throwIfAborted(): void {
    this.manager.throwIfAborted(this.id);
  }

  update(patch: JobPatch): void {
    this.manager.update(this.id, patch);
  }
}

export class JobManager {
  private readonly records = new Map<string, JobRecord>();

  create(init: ImportJobInit): JobHandle;
  create(init: ImportLibraryJobInit): JobHandle;
  create(init: ScrapeJobInit): JobHandle;
  create(init: JobInit): JobHandle {
    const now = Date.now();
    const job = { id: nextJobId(), createdAt: now, updatedAt: now, ...init } as Job;
    this.records.set(job.id, { job, logs: [], abortRequested: false });
    return new JobHandleImpl(job.id, this);
  }

  update(id: string, patch: JobPatch): void {
    const record = this.records.get(id);
    if (record === undefined) return;
    if (isTerminal(record.job.status)) return;
    Object.assign(record.job, patch, { updatedAt: Date.now() });
  }

  get(id: string): Job | undefined {
    const record = this.records.get(id);
    return record === undefined ? undefined : structuredClone(record.job);
  }

  getLog(id: string): JobLogLine[] | undefined {
    const record = this.records.get(id);
    return record === undefined ? undefined : structuredClone(record.logs);
  }

  appendLog(id: string, level: JobLogLevel, message: string): void {
    const record = this.records.get(id);
    if (record === undefined) return;
    if (isTerminal(record.job.status)) return;
    record.logs.push({ ts: Date.now(), level, message });
    record.job.updatedAt = Date.now();
  }

  requestStop(id: string): void {
    const record = this.records.get(id);
    if (record === undefined) return;
    record.abortRequested = true;
    record.job.updatedAt = Date.now();
  }

  throwIfAborted(id: string): void {
    const record = this.records.get(id);
    if (record?.abortRequested === true) {
      throw new JobAbortError();
    }
  }
}
```

Export from `apps/core/src/index.ts` next to the existing job type export:

```ts
export type { JobHandle } from "./jobs/jobHandle";
export { JobAbortError } from "./jobs/jobAbortError";
export type { JobLogLevel, JobLogLine } from "./jobs/types";
```

Keep the existing `export type { ImportJob, … } from "./jobs/types"`.

- [ ] **Step 4: Run the tests and make sure they pass**

Run: `pnpm --filter @smm/core test -- src/jobs/jobManager.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/core/src/jobs/types.ts apps/core/src/jobs/jobAbortError.ts apps/core/src/jobs/jobHandle.ts apps/core/src/jobs/jobManager.ts apps/core/src/jobs/jobManager.test.ts apps/core/src/index.ts
git commit -m "$(cat <<'EOF'
feat(core): add JobManager with logs and abort handle

EOF
)"
```

---

### Task 2: Switch Core from JobStore to JobManager

**Files:**
- Modify: `apps/core/src/Core.ts` (`import { JobStore }` → `JobManager`; `private readonly jobs = new JobStore()` → `new JobManager()`; `create()` now returns `JobHandle` so `job.id` still works; change `runImport(job: ImportJob, …)` first parameter type to `JobHandle`; change `runImportLibrary(job: ImportLibraryJob, …)` first parameter type to `JobHandle`)
- Delete: `apps/core/src/jobs/jobStore.ts`
- Delete: `apps/core/src/jobs/jobStore.test.ts`

**Interfaces:**
- Consumes: `JobManager.create(): JobHandle`, `JobManager.update`, `JobManager.get` from Task 1
- Produces: Core scrape / import / import-library still compile and existing Core tests pass. `create()` callers use `handle.id` instead of snapshot fields. `runImport` / `runImportLibrary` take `JobHandle` and keep calling `this.jobs.update(job.id, …)` / `this.jobs.get(job.id)` / `job.id`.

- [ ] **Step 1: Make typecheck fail by swapping the store type only**

In `apps/core/src/Core.ts`, replace `import { JobStore } from "./jobs/jobStore"` with `import { JobManager } from "./jobs/jobManager"` and `private readonly jobs = new JobStore()` with `private readonly jobs = new JobManager()`. Leave `runImport(job: ImportJob, …)` and `runImportLibrary(job: ImportLibraryJob, …)` unchanged.

- [ ] **Step 2: Run typecheck to verify it fails**

Run: `pnpm --filter @smm/core typecheck`

Expected: FAIL assigning `JobHandle` to `ImportJob` / `ImportLibraryJob` (or missing `folderPath` on the handle) at `void this.runImport(job, …)` / `void this.runImportLibrary(job, …)`.

- [ ] **Step 3: Minimal Core wiring**

In `apps/core/src/Core.ts`:

1. Replace `import { JobStore } from "./jobs/jobStore"` with `import { JobManager } from "./jobs/jobManager"`.
2. Add `import type { JobHandle } from "./jobs/jobHandle"`.
3. Keep `import { initialScrapeTasks, type ImportJob, type ImportLibraryJob, type Job } from "./jobs/types"` — drop `ImportJob` / `ImportLibraryJob` from that import if unused after the signature change.
4. Replace `private readonly jobs = new JobStore()` with `private readonly jobs = new JobManager()`.
5. Change `private async runImport(job: ImportJob, …)` to `private async runImport(job: JobHandle, …)`.
6. Change `private async runImportLibrary(job: ImportLibraryJob, …)` to `private async runImportLibrary(job: JobHandle, …)`.
7. Leave `this.jobs.create({…})` assignments as `const job = this.jobs.create({…})` — they become handles; `job.id` stays valid.
8. Delete `apps/core/src/jobs/jobStore.ts` and `apps/core/src/jobs/jobStore.test.ts`.

Do not add `stopJob` / `getJobLog` or import log lines yet.

- [ ] **Step 4: Run tests**

Run: `pnpm --filter @smm/core test -- src/Core.test.ts src/jobs/jobManager.test.ts`

Expected: PASS (existing import / importLibrary / scrape job tests still pass).

Run: `pnpm --filter @smm/core typecheck`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/core/src/Core.ts apps/core/src/jobs/jobStore.ts apps/core/src/jobs/jobStore.test.ts
git commit -m "$(cat <<'EOF'
refactor(core): store jobs in JobManager instead of JobStore

EOF
)"
```

---

### Task 3: Core.stopJob and Core.getJobLog

**Files:**
- Modify: `apps/core/src/Core.ts` (add `stopJob` / `getJobLog` next to `getJob`)
- Modify: `apps/core/src/Core.test.ts` (new describe block)
- Modify: `apps/core/src/index.ts` if `JobLogLine` is not already exported (done in Task 1)

**Interfaces:**
- Consumes: `JobManager.get`, `JobManager.getLog`, `JobManager.requestStop` from Task 1
- Produces:
  - `getJob(id: string): Job | undefined` (unchanged)
  - `getJobLog(id: string): JobLogLine[]` — throws `new Error("Job not found")` when `get(id)` is undefined; otherwise `getLog(id) ?? []`
  - `stopJob(id: string): void` — unknown → `new Error("Job not found")`; `kind !== "import"` → `new Error("Job is not abortable")`; status not `pending` or `running` → `new Error("Job already finished")`; else `this.jobs.requestStop(id)` and return without changing `status`

- [ ] **Step 1: Write the failing Core tests**

Add this block to `apps/core/src/Core.test.ts` (reuse `inMemoryFs` / `emptyNetwork` / `NoopLoggerAdapter` already in that file):

```ts
describe("stopJob and getJobLog", () => {
  it("getJobLog throws Job not found for unknown id", () => {
    const core = new Core({ fs: inMemoryFs(), network: emptyNetwork(), appDataDir: "/data/smm" });
    expect(() => core.getJobLog("missing")).toThrow("Job not found");
  });

  it("stopJob throws Job not found for unknown id", () => {
    const core = new Core({ fs: inMemoryFs(), network: emptyNetwork(), appDataDir: "/data/smm" });
    expect(() => core.stopJob("missing")).toThrow("Job not found");
  });

  it("stopJob throws Job already finished after skipInit import succeeds", async () => {
    const core = new Core({
      fs: inMemoryFs(),
      network: emptyNetwork(),
      logger: new NoopLoggerAdapter(),
      appDataDir: "/data/smm",
    });
    const { id } = await core.importFolder("/m/Deferred", "tvshow", { skipInit: true });
    await waitForStatus(core, id, "succeeded");
    expect(() => core.stopJob(id)).toThrow("Job already finished");
    expect(core.getJob(id)?.status).toBe("succeeded");
  });

  it("getJobLog returns an array for an existing job", async () => {
    const core = new Core({
      fs: inMemoryFs(),
      network: emptyNetwork(),
      logger: new NoopLoggerAdapter(),
      appDataDir: "/data/smm",
    });
    const { id } = await core.importFolder("/m/Deferred", "music", { skipInit: true });
    await waitForStatus(core, id, "succeeded");
    expect(Array.isArray(core.getJobLog(id))).toBe(true);
  });

  it("stopJob throws Job is not abortable for a running import-library job", async () => {
    const base = inMemoryFs({ "/lib/A/track.mp3": "" });
    const fs: FsPort = {
      ...base,
      exists: vi.fn(async () => true),
      listSubdirectories: vi.fn(() => new Promise<string[]>(() => {})),
    };
    const core = new Core({
      fs,
      network: emptyNetwork(),
      logger: new NoopLoggerAdapter(),
      appDataDir: "/data/smm",
    });
    const { id } = core.importLibrary("/lib", "music");
    await new Promise((r) => setTimeout(r, 20));
    expect(core.getJob(id)?.kind).toBe("import-library");
    expect(core.getJob(id)?.status).toBe("pending");
    expect(() => core.stopJob(id)).toThrow("Job is not abortable");
  });
});
```

`stopJob` must check `kind` before terminal status so a finished import-library is `Job already finished`, while a still-pending import-library is `Job is not abortable`.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter @smm/core test -- src/Core.test.ts`

Expected: FAIL (`stopJob` / `getJobLog` is not a function).

- [ ] **Step 3: Implement Core methods**

Import `JobLogLine` in `Core.ts`. Place next to `getJob`:

```ts
  getJob(id: string): Job | undefined {
    return this.jobs.get(id);
  }

  getJobLog(id: string): JobLogLine[] {
    const job = this.jobs.get(id);
    if (job === undefined) {
      throw new Error("Job not found");
    }
    return this.jobs.getLog(id) ?? [];
  }

  stopJob(id: string): void {
    const job = this.jobs.get(id);
    if (job === undefined) {
      throw new Error("Job not found");
    }
    if (job.kind !== "import") {
      throw new Error("Job is not abortable");
    }
    if (job.status !== "pending" && job.status !== "running") {
      throw new Error("Job already finished");
    }
    this.jobs.requestStop(id);
  }
```

- [ ] **Step 4: Run tests**

Run: `pnpm --filter @smm/core test -- src/Core.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/core/src/Core.ts apps/core/src/Core.test.ts
git commit -m "$(cat <<'EOF'
feat(core): add stopJob and getJobLog

EOF
)"
```

---

### Task 4: ImportJob writes logs and honors cooperative abort

**Files:**
- Modify: `apps/core/src/pipeline/importFolderPipeline.ts`
- Modify: `apps/core/src/pipeline/importFolderPipeline.test.ts`
- Modify: `apps/core/src/Core.ts` (`importFolder`, `runImport`)
- Modify: `apps/core/src/Core.test.ts`

**Interfaces:**
- Consumes: `JobHandle.appendLog`, `throwIfAborted`, `update`; `JobAbortError`; `Core.stopJob` from Task 3
- Produces: `FolderInitializationCallbacks` extended with optional `throwIfAborted?: () => void` and `appendLog?: (level: JobLogLevel, message: string) => void`. `initializeFolder` calls `throwIfAborted` before listing files, before `autoRecognizeFolderPipeline`, and before `recognizeMediaFilesPipeline`. User log lines match Global Constraints. `runImport` catches `JobAbortError`, logs `aborted` at `warn`, then sets `status: "aborted", error: "aborted"`. Other errors log `error` message then `status: "failed"`. Success logs `succeeded` then sets `succeeded`. `importFolder` logs `persisted folder` after stage 1; `skipInit` logs `skipped init` then `succeeded`. Stage 1 failure logs the exception message at `error` then `failed`. Music skips stage 2/3 log lines.

- [ ] **Step 1: Write failing tests**

Add to `apps/core/src/pipeline/importFolderPipeline.test.ts` inside the existing `initializeFolder` describe (or a new one). The file already mocks `./recognizeMediaFolder`. Spy `recognizeMediaFilesPipeline` as well if not already mocked — if `initializeFolder` would call it, mock `./recognizeMediaFiles` like:

At top of `importFolderPipeline.test.ts` (next to the recognizeMediaFolder mock):

```ts
vi.mock("./recognizeMediaFiles", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./recognizeMediaFiles")>();
  return {
    ...actual,
    recognizeMediaFilesPipeline: vi.fn(async () => {}),
  };
});
```

Then:

```ts
it("invokes throwIfAborted before recognizeFolder", async () => {
  const { deps } = makeDeps({ "/m/Show/S01E01.mkv": "" });
  const throwIfAborted = vi.fn(() => {
    throw new Error("stopped");
  });
  await expect(
    initializeFolder("/m/Show", "tvshow", deps, { throwIfAborted }),
  ).rejects.toThrow("stopped");
  expect(mockRecognizeMediaFolder).not.toHaveBeenCalled();
});
```

`makeDeps` currently builds `FolderInitializationDeps`. Pass `throwIfAborted` in callbacks (4th arg), not deps.

Add Core tests to `apps/core/src/Core.test.ts`:

```ts
describe("importFolder job logs and abort", () => {
  it("writes persisted folder and succeeded logs for music", async () => {
    const core = new Core({
      fs: inMemoryFs({ "/m/My.Music/a.mp3": "" }),
      network: emptyNetwork(),
      logger: new NoopLoggerAdapter(),
      appDataDir: "/data/smm",
    });
    const { id } = await core.importFolder("/m/My.Music", "music");
    await waitForStatus(core, id, "succeeded");
    expect(core.getJobLog(id).map((l) => l.message)).toEqual([
      "persisted folder",
      "succeeded",
    ]);
    expect(core.getJob(id) as { logs?: unknown }).not.toHaveProperty("logs");
  });

  it("writes skipped init when skipInit is true", async () => {
    const core = new Core({
      fs: inMemoryFs(),
      network: emptyNetwork(),
      logger: new NoopLoggerAdapter(),
      appDataDir: "/data/smm",
    });
    const { id } = await core.importFolder("/m/Deferred", "tvshow", { skipInit: true });
    await waitForStatus(core, id, "succeeded");
    expect(core.getJobLog(id).map((l) => l.message)).toEqual([
      "persisted folder",
      "skipped init",
    ]);
  });

  it("aborts at the stage-2 boundary without recognizing", async () => {
    const base = inMemoryFs({ "/m/Show/S01E01.mkv": "" });
    const fs: FsPort = {
      ...base,
      listFiles: vi.fn(async () => {
        await new Promise((r) => setTimeout(r, 80));
        return base.listFiles("/m/Show");
      }),
    };
    const core = new Core({
      fs,
      network: emptyNetwork(),
      logger: new NoopLoggerAdapter(),
      appDataDir: "/data/smm",
    });
    const { id } = await core.importFolder("/m/Show", "tvshow");
    core.stopJob(id);
    await waitForStatus(core, id, "aborted");
    const job = core.getJob(id);
    expect(job?.status).toBe("aborted");
    expect(job?.error).toBe("aborted");
    expect(core.getJobLog(id).map((l) => l.message)).toContain("aborted");
    expect(await core.getFolders()).toContain("/m/Show");
    expect(await core.getMetadata("/m/Show")).toMatchObject({
      mediaFolderPath: "/m/Show",
      type: "tvshow-folder",
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @smm/core test -- src/Core.test.ts src/pipeline/importFolderPipeline.test.ts`

Expected: FAIL (log messages missing and/or abort stays `running` / becomes `failed`).

- [ ] **Step 3: Implement pipeline + Core orchestration**

In `apps/core/src/pipeline/importFolderPipeline.ts`:

1. Import `JobLogLevel` from `../jobs/types`.
2. Extend callbacks:

```ts
export interface FolderInitializationCallbacks {
  onStage?: (stage: JobStage, progress: number, detail?: { title?: string }) => void;
  throwIfAborted?: () => void;
  appendLog?: (level: JobLogLevel, message: string) => void;
}
```

3. Change `initializeFolder` to:

```ts
export async function initializeFolder(
  folderPath: string,
  type: FolderType,
  deps: FolderInitializationDeps,
  cb: FolderInitializationCallbacks = {},
): Promise<void> {
  const posixPath = deps.normalizePosix(folderPath);
  cb.throwIfAborted?.();
  const filePaths = (await deps.fs.listFiles(posixPath)).map((file) => Path.posix(file));
  if (type !== "tvshow" && type !== "movie") return;

  cb.throwIfAborted?.();
  deps.logger.info({ folderPath: posixPath, type }, "importFolder: stage=recognizeFolder");
  cb.appendLog?.("info", "recognizing folder");
  const result = await autoRecognizeFolderPipeline(folderPath, deps, filePaths);
  const title = result.tvShow?.name ?? result.movie?.name;
  if (title !== undefined) {
    cb.appendLog?.("info", `recognized "${title}"`);
  } else {
    cb.appendLog?.("info", "recognition completed, no title");
  }
  cb.onStage?.("recognizeFolder", 60, title !== undefined ? { title } : undefined);

  cb.throwIfAborted?.();
  deps.logger.info({ folderPath: posixPath }, "importFolder: stage=recognizeEpisodes");
  cb.appendLog?.("info", "recognizing episodes");
  await recognizeMediaFilesPipeline(folderPath, deps, filePaths);
  cb.appendLog?.("info", "recognized episodes");
  cb.onStage?.("recognizeEpisodes", 90);
}
```

Keep `LoggerPort` lines exactly as today (`importFolder: stage=…`).

In `apps/core/src/Core.ts` `importFolder` and `runImport`:

- After successful `persistNewFolder` (or skipRegistration): `handle.appendLog("info", "persisted folder")` then `handle.update({ stage: "persistFolder", progress: 10 })`.
- Stage 1 catch: `handle.appendLog("error", error instanceof Error ? error.message : String(error))` then `handle.update({ status: "failed", error: … })`.
- `skipInit`: `handle.appendLog("info", "skipped init")` then `handle.update({ status: "succeeded", progress: 100 })`.
- `runImport`: import `JobAbortError`. Use `JobHandle`. After `handle.update({ status: "running" })`, `handle.throwIfAborted()`. Pass into `initializeFolder`:

```ts
{
  onStage: (stage, progress, detail) => {
    handle.update({
      stage,
      progress,
      ...(detail?.title !== undefined ? { recognizedTitle: detail.title } : {}),
    });
  },
  throwIfAborted: () => handle.throwIfAborted(),
  appendLog: (level, message) => handle.appendLog(level, message),
}
```

Catch:

```ts
    } catch (error) {
      if (error instanceof JobAbortError) {
        handle.appendLog("warn", "aborted");
        handle.update({ status: "aborted", error: "aborted" });
        return;
      }
      const message = error instanceof Error ? error.message : String(error);
      handle.appendLog("error", message);
      handle.update({ status: "failed", error: message });
    }
```

Success path: `handle.appendLog("info", "succeeded")` then `handle.update({ status: "succeeded", stage: null, progress: 100 })` then `notifyMediaMetadataUpdated`.

- [ ] **Step 4: Run tests**

Run: `pnpm --filter @smm/core test -- src/Core.test.ts src/pipeline/importFolderPipeline.test.ts src/pipeline/importFolderPipeline.integration.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/core/src/pipeline/importFolderPipeline.ts apps/core/src/pipeline/importFolderPipeline.test.ts apps/core/src/Core.ts apps/core/src/Core.test.ts
git commit -m "$(cat <<'EOF'
feat(core): write ImportJob logs and abort at stage boundaries

EOF
)"
```

---

### Task 5: HTTP POST /api/stop-job and POST /api/get-job-log

**Files:**
- Create: `apps/cli/src/route/StopJob.ts`
- Create: `apps/cli/src/route/StopJob.test.ts`
- Create: `apps/cli/src/route/GetJobLog.ts`
- Create: `apps/cli/src/route/GetJobLog.test.ts`
- Modify: `apps/cli/server.ts` (import + `handleStopJob` / `handleGetJobLog` next to `handleGetJob`)
- Modify: `docs/api/index.md` (document the two routes under GetJob)

**Interfaces:**
- Consumes: `Core.stopJob(id: string): void`, `Core.getJobLog(id: string): JobLogLine[]`
- Produces:
  - `POST /api/stop-job` body `{ id }` → `{ data: { id } }` or `{ error: "Error Reason: …" }`
  - `POST /api/get-job-log` body `{ id }` → `{ data: { lines: JobLogLine[] } }` or `{ error }`
  - Missing/blank id: `Error Reason: id is required` (copy GetJob.ts parsing)
  - HTTP 200 always for business errors

Copy the request-id parsing and try/catch pattern from `apps/cli/src/route/GetJob.ts` exactly (same 200 + `Error Reason:` prefix). Register both handlers in `apps/cli/server.ts` immediately after `handleGetJob(this.app)`.

- [ ] **Step 1: Write failing HTTP tests**

Create `apps/cli/src/route/GetJobLog.test.ts` using the same `USER_DATA_DIR` / `resetCoreForTests` / Hono setup as `GetJob.test.ts`. Register `handleImportFolder`, `handleGetJobLog`.

```ts
  it('returns Error Reason when id is missing', async () => {
    const res = await app.request('/api/get-job-log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    expect(res.status).toBe(200)
    const json = (await res.json()) as { error?: string }
    expect(json.error).toMatch(/^Error Reason: id is required/)
  })

  it('returns Error Reason when the job is unknown', async () => {
    const res = await app.request('/api/get-job-log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: 'missing' }),
    })
    expect(res.status).toBe(200)
    const json = (await res.json()) as { error?: string }
    expect(json.error).toMatch(/^Error Reason: Job not found/)
  })

  it('returns log lines after skipInit import', async () => {
    const imported = await app.request('/api/import-folder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: '/media/A', type: 'music', skipInit: true }),
    })
    const { data } = (await imported.json()) as { data: { id: string } }
    const res = await app.request('/api/get-job-log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: data.id }),
    })
    expect(res.status).toBe(200)
    const json = (await res.json()) as { data?: { lines: { message: string }[] } }
    expect(json.data?.lines.map((l) => l.message)).toEqual([
      'persisted folder',
      'skipped init',
    ])
  })
```

Create `apps/cli/src/route/StopJob.test.ts` with the same harness, register `handleImportFolder` + `handleStopJob` + `handleGetJob`.

```ts
  it('returns Error Reason when id is missing', async () => { /* same as get-job */ })

  it('returns Error Reason when the job is unknown', async () => {
    const res = await app.request('/api/stop-job', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: 'missing' }),
    })
    expect(res.status).toBe(200)
    const json = (await res.json()) as { error?: string }
    expect(json.error).toMatch(/^Error Reason: Job not found/)
  })

  it('returns Job already finished for skipInit import', async () => {
    const imported = await app.request('/api/import-folder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: '/media/A', type: 'music', skipInit: true }),
    })
    const { data } = (await imported.json()) as { data: { id: string } }
    const res = await app.request('/api/stop-job', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: data.id }),
    })
    expect(res.status).toBe(200)
    const json = (await res.json()) as { error?: string }
    expect(json.error).toMatch(/^Error Reason: Job already finished/)
  })
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter cli test -- src/route/StopJob.test.ts src/route/GetJobLog.test.ts`

Expected: FAIL (Cannot find module `./StopJob` / `./GetJobLog`, or 404).

- [ ] **Step 3: Implement routes and register them**

`apps/cli/src/route/GetJobLog.ts`:

```ts
import type { Hono } from 'hono'
import type { JobLogLine } from '@smm/core'
import { getCore } from '../core/getCore'
import { logger } from '../../lib/logger'

interface GetJobLogResponseBody {
  data?: { lines: JobLogLine[] }
  error?: string
}

export function handleGetJobLog(app: Hono): void {
  app.post('/api/get-job-log', async (c) => {
    try {
      let body: unknown = {}
      try {
        body = await c.req.json()
      } catch {
        /* empty body */
      }
      const id =
        typeof body === 'object' && body !== null && 'id' in body
          ? (body as { id: unknown }).id
          : undefined
      if (typeof id !== 'string' || id.trim() === '') {
        const err: GetJobLogResponseBody = { error: 'Error Reason: id is required' }
        return c.json(err, 200)
      }
      const lines = getCore().getJobLog(id)
      return c.json({ data: { lines } }, 200)
    } catch (error) {
      logger.error({ error }, '[POST /api/get-job-log] route error')
      return c.json(
        {
          error: `Error Reason: ${error instanceof Error ? error.message : 'Unknown error'}`,
        },
        200,
      )
    }
  })
}
```

`apps/cli/src/route/StopJob.ts` — same id parsing; call `getCore().stopJob(id)` then return `{ data: { id } }`. Catch and prefix `Error Reason:` like GetJob.

In `apps/cli/server.ts` add imports and:

```ts
    handleGetJob(this.app);
    handleStopJob(this.app);
    handleGetJobLog(this.app);
```

Update `docs/api/index.md` GetJob section to:

```
## GetJob
Source Code: apps/cli/src/route/GetJob.ts
HTTP: `POST /api/get-job` — returns an in-memory job from `Core.getJob(id)`. Request body: `{ id: string }`. Response: `{ data: Job }` or `{ error }` (`Job not found`). Snapshot does not include logs.

## GetJobLog
Source Code: apps/cli/src/route/GetJobLog.ts
HTTP: `POST /api/get-job-log` — returns user-visible log lines from `Core.getJobLog(id)`. Request body: `{ id: string }`. Response: `{ data: { lines: JobLogLine[] } }` or `{ error }` (`Job not found`). CLI equivalent: `smm job log`.

## StopJob
Source Code: apps/cli/src/route/StopJob.ts
HTTP: `POST /api/stop-job` — requests abort of a running ImportJob via `Core.stopJob(id)`. Request body: `{ id: string }`. Response: `{ data: { id } }` or `{ error }` (`Job not found` / `Job is not abortable` / `Job already finished`). Abort is cooperative at import stage boundaries. CLI equivalent: `smm job stop`.
```

- [ ] **Step 4: Run tests**

Run: `pnpm --filter cli test -- src/route/StopJob.test.ts src/route/GetJobLog.test.ts src/route/GetJob.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/cli/src/route/StopJob.ts apps/cli/src/route/StopJob.test.ts apps/cli/src/route/GetJobLog.ts apps/cli/src/route/GetJobLog.test.ts apps/cli/server.ts docs/api/index.md
git commit -m "$(cat <<'EOF'
feat(cli): add stop-job and get-job-log HTTP routes

EOF
)"
```

---

### Task 6: CLI `smm job log` and `smm job stop`

**Files:**
- Modify: `apps/cli/src/cli/runCli.ts` (replace the single `job` command with a parent command plus `log` / `stop` subcommands; keep `smm job <id>` printing status)
- Create: `apps/cli/src/cli/job.test.ts`

**Interfaces:**
- Consumes: `getCore().getJob`, `getCore().getJobLog`, `getCore().stopJob`
- Produces:
  - `smm job <id>` — existing behavior (scrape task lines; import / import-library JSON)
  - `smm job log <id>` — one `line.message` per stdout line; unknown id stderr + exit 1
  - `smm job stop <id>` — no stdout on success, exit 0; errors stderr + exit 1

Commander layout (same nesting style as `planCmd` in `runCli.ts`):

```ts
  const jobCmd = program.command('job').description('Show job status, print log, or stop a job')

  jobCmd
    .command('log')
    .description('Print job log messages')
    .argument('<jobId>', 'Job id')
    .action(async (jobId: string) => {
      try {
        const lines = getCore().getJobLog(jobId)
        for (const line of lines) {
          console.log(line.message)
        }
      } catch (error) {
        console.error(error instanceof Error ? error.message : String(error))
        exitCode = 1
      }
    })

  jobCmd
    .command('stop')
    .description('Abort a running import job')
    .argument('<jobId>', 'Job id')
    .action(async (jobId: string) => {
      try {
        getCore().stopJob(jobId)
      } catch (error) {
        console.error(error instanceof Error ? error.message : String(error))
        exitCode = 1
      }
    })

  jobCmd
    .argument('<jobId>', 'Job id from scrape or add')
    .action(async (jobId: string) => {
      try {
        const job = getCore().getJob(jobId)
        if (job === undefined) {
          console.error(`Job not found: ${jobId}`)
          exitCode = 1
          return
        }
        if (job.kind === 'scrape') {
          for (const line of formatScrapeJobTaskLines(job)) {
            console.log(line)
          }
          return
        }
        if (job.kind === 'import-library') {
          printJson(job)
          return
        }
        printJson(job)
      } catch (error) {
        console.error(error instanceof Error ? error.message : String(error))
        exitCode = 1
      }
    })
```

- [ ] **Step 1: Write failing CLI tests**

Create `apps/cli/src/cli/job.test.ts`. `smm add` does not print a job id, so seed the in-process Core then invoke CLI:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { MockInstance } from 'vitest'
import { mkdtempSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { getCore, resetCoreForTests } from '../core/getCore'

describe('smm job', () => {
  let userDataDir: string
  let mediaFolder: string
  let prevUserDataDir: string | undefined
  let logSpy: MockInstance<(...args: any[]) => void>
  let errorSpy: MockInstance<(...args: any[]) => void>

  beforeEach(() => {
    prevUserDataDir = process.env.USER_DATA_DIR
    userDataDir = mkdtempSync(join(tmpdir(), 'smm-job-cli-'))
    mediaFolder = mkdtempSync(join(tmpdir(), 'smm-job-media-'))
    process.env.USER_DATA_DIR = userDataDir
    resetCoreForTests()
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    logSpy.mockRestore()
    errorSpy.mockRestore()
    resetCoreForTests()
    if (prevUserDataDir === undefined) delete process.env.USER_DATA_DIR
    else process.env.USER_DATA_DIR = prevUserDataDir
    rmSync(userDataDir, { recursive: true, force: true })
    rmSync(mediaFolder, { recursive: true, force: true })
  })

  it('prints job JSON for smm job <id>', async () => {
    writeFileSync(join(mediaFolder, 'track.mp3'), 'x')
    const { id } = await getCore().importFolder(mediaFolder, 'music', { skipInit: true })
    const { runCli } = await import('./runCli')
    const code = await runCli(['node', 'smm', 'job', id])
    expect(code).toBe(0)
    const printed = logSpy.mock.calls.map((c) => c.map(String).join(' ')).join('\n')
    expect(printed).toContain(id)
    expect(printed).toContain('"kind": "import"')
  })

  it('prints log messages for smm job log', async () => {
    writeFileSync(join(mediaFolder, 'track.mp3'), 'x')
    const { id } = await getCore().importFolder(mediaFolder, 'music', { skipInit: true })
    const { runCli } = await import('./runCli')
    const code = await runCli(['node', 'smm', 'job', 'log', id])
    expect(code).toBe(0)
    const lines = logSpy.mock.calls.map((c) => String(c[0]))
    expect(lines).toEqual(['persisted folder', 'skipped init'])
  })

  it('exits 1 for smm job log with unknown id', async () => {
    const { runCli } = await import('./runCli')
    const code = await runCli(['node', 'smm', 'job', 'log', 'missing'])
    expect(code).toBe(1)
    expect(errorSpy).toHaveBeenCalled()
  })

  it('exits 1 for smm job stop on a finished import', async () => {
    writeFileSync(join(mediaFolder, 'track.mp3'), 'x')
    const { id } = await getCore().importFolder(mediaFolder, 'music', { skipInit: true })
    const { runCli } = await import('./runCli')
    const code = await runCli(['node', 'smm', 'job', 'stop', id])
    expect(code).toBe(1)
    expect(errorSpy.mock.calls.map((c) => String(c[0])).join('\n')).toContain(
      'Job already finished',
    )
  })
})
```

Dynamic `import('./runCli')` matches `add.test.ts` so Commander is loaded after env is set.

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter cli test -- src/cli/job.test.ts`

Expected: FAIL (`unknown command 'log'` or job log not implemented).

- [ ] **Step 3: Implement Commander subcommands** as specified in Interfaces. Keep scrape formatting in the default `job <id>` action.

- [ ] **Step 4: Run tests**

Run: `pnpm --filter cli test -- src/cli/job.test.ts src/cli/add.test.ts`

Expected: PASS (`smm add` still works; `smm job <id>` still prints JSON).

- [ ] **Step 5: Commit**

```bash
git add apps/cli/src/cli/runCli.ts apps/cli/src/cli/job.test.ts
git commit -m "$(cat <<'EOF'
feat(cli): add smm job log and smm job stop

EOF
)"
```

---

### Task 7: Typecheck and regression gate

**Files:** none new. Confirm docs already written (`docs/dev/job.md`, `docs/dev/import-folder.md`, spec).

**Interfaces:**
- Consumes: all previous tasks
- Produces: green Core + CLI unit tests and typecheck

- [ ] **Step 1: Run Core tests**

Run: `pnpm --filter @smm/core test`

Expected: PASS

- [ ] **Step 2: Run CLI unit tests that touch jobs/import**

Run: `pnpm --filter cli test -- src/cli/job.test.ts src/cli/add.test.ts src/route/GetJob.test.ts src/route/StopJob.test.ts src/route/GetJobLog.test.ts src/route/ImportFolder.test.ts`

Expected: PASS

- [ ] **Step 3: Typecheck**

Run: `pnpm --filter @smm/core typecheck`

Run: `pnpm --filter cli typecheck`

Expected: PASS

- [ ] **Step 4: Do not create an empty commit.** If typecheck or tests forced a fix, commit that fix with a message that names the failure.

---

## Self-review (spec coverage)

| Spec requirement | Task |
|------------------|------|
| JobLogLine / getJob without logs | 1, 4 |
| JobHandle create / appendLog / requestStop / throwIfAborted / update | 1 |
| Delete JobStore | 2 |
| Core.getJob unchanged snapshot | 2, 3 |
| Core.stopJob / getJobLog error table | 3 |
| Import logs + cooperative abort + no rollback | 4 |
| HTTP stop-job / get-job-log | 5 |
| CLI job log / job stop, in-process Core | 6 |
| No UI / core-routes / scrape abort / persistence | Global Constraints |
| docs/dev/job.md and import-folder.md | Already updated with the spec; not re-opened here |
| docs/api/index.md | 5 |
