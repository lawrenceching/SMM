# apps/cicd — General-Purpose Task Runner Design

Date: 2026-06-30
Status: Pending implementation

## Problem

The repo currently has `ci/run-e2e-test.ts`, a Bun script that orchestrates the SMM e2e workflow (start CLI/UI dev servers → wait for readiness → run WebdriverIO → collect logs). It is hardcoded for one workflow: the background tasks are `pnpm dev:cli` and `pnpm dev:ui`, the task is `pnpm wdio`, and readiness is detected via HTTP polling against fixed URLs.

When a different project (or a new SMM workflow) wants the same orchestration shape — start N background processes, run M tasks against them, collect per-task log slices — there is no reusable tool. Each new workflow would either fork `ci/run-e2e-test.ts` and edit it, or write its own ad-hoc script.

`apps/cicd` is the reusable replacement: a config-driven, JSON-serialized timeline orchestrator that any project can drop in and run.

## Goal

Provide a small, general-purpose orchestrator that:

1. Accepts a JSON config declaring background tasks and tasks.
2. Spawns background tasks, captures their stdout/stderr onto a unified JSONL timeline.
3. Runs tasks serially against the live backgrounds, capturing each task's own output onto the same timeline.
4. After all tasks finish (or on failure), slices the timeline per-task and writes plain-text log files for easy debugging / CI artifacts.
5. Exits with the conventional CI exit code (0 success / 1 failure).

Out of scope for v1: concurrent tasks, pluggable readiness checks beyond `delayMs`, real-time log streaming, log rotation, TUI / live tail.

## Non-Goals

- **Not a replacement for `ci/run-e2e-test.ts`** in this iteration. `ci/run-e2e-test.ts` continues to serve the SMM e2e workflow. A future migration can swap it for an `apps/cicd` config when ready.
- **Not a CI server.** It runs one config to completion and exits; no daemon mode.
- **Not a build tool.** It does not understand task dependency graphs, caching, or incremental builds.

## Architecture

```
apps/cicd/
├── package.json              # name: "@smm/cicd", type: "module"
├── tsconfig.json
├── src/
│   ├── index.ts              # Library entry — exports `run(config)`
│   ├── orchestrator.ts       # High-level flow control
│   ├── process-manager.ts    # spawn / kill / signal handling
│   ├── log-store.ts          # JSONL timeline writer (one file per source)
│   ├── slicer.ts             # Time-window slice → plain text
│   ├── config.ts             # Zod schema + validation
│   └── types.ts              # Shared types
├── run.ts                    # Thin CLI — parses args, calls run(), exits
└── test/                     # Unit + integration tests
```

**Layer responsibilities:**

| Module | Responsibility | Knows about |
|---|---|---|
| `run.ts` | CLI arg parsing (`-f <config>`), call `run()`, exit | `index.ts` |
| `index.ts` | Public library API: `run({ configPath, cwd })` returns `Promise<ExitCode>` | `orchestrator.ts` |
| `orchestrator.ts` | Sequence: validate → spawn backgrounds → run tasks → kill backgrounds → slice → cleanup | `process-manager`, `log-store`, `slicer`, `config` |
| `process-manager.ts` | Spawn child with piped stdio, kill process tree, handle SIGINT/SIGTERM | Node `child_process` |
| `log-store.ts` | Append-only JSONL writer per source; produces `{ timestamp, message, stream }` lines | `fs` |
| `slicer.ts` | Read JSONL, filter by `[startMs, endMs]`, write plain text | `fs`, `readline` |
| `config.ts` | Zod schema, defaults, error formatting | `zod` |

**Data flow:**

```
config.json
   │
   ▼  Zod validate
ValidatedConfig
   │
   ▼  spawn children
stdout/stderr chunks
   │
   ▼  log-store appends with timestamp from orchestrator clock
<outputDir>/<commandId>/_timeline/
   ├── server.jsonl         (from background "server")
   ├── frontend.jsonl       (from background "frontend")
   └── TestA.e2e.ts.jsonl   (from task "TestA.e2e.ts")
   │
   ▼  slicer reads timeline, filters by [startTime, endTime] of each task
<outputDir>/<commandId>/
   └── TestA.e2e.ts/
       ├── main.log         (task's own stdout/stderr → plain text)
       ├── server.log       (background "server" slice during task window)
       └── frontend.log     (background "frontend" slice during task window)
```

## Config Schema (Zod)

```typescript
import { z } from 'zod';

export const BackgroundTaskSchema = z.object({
  name: z.string().min(1),                              // unique within config
  command: z.string().min(1),                            // single shell command
  cwd: z.string().optional(),                            // default: orchestrator cwd
  env: z.record(z.string()).optional(),                  // shallow-merged over process.env
  delayMs: z.number().int().nonnegative().default(0),    // considered ready after N ms
});

export const TaskSchema = z.object({
  name: z.string().min(1),                               // unique; also output dir name
  command: z.string().min(1),
  cwd: z.string().optional(),
  env: z.record(z.string()).optional(),
  timeoutMs: z.number().int().positive().optional(),     // unset = no timeout
});

export const ConfigSchema = z.object({
  name: z.string().min(1),                               // human-readable run name
  background: z.array(BackgroundTaskSchema).default([]),
  tasks: z.array(TaskSchema).min(1),
  outputDir: z.string().default('./artifacts/cicd'),     // resolved relative to orchestrator cwd
  stopOnFailure: z.boolean().default(true),
  keepRawTimeline: z.boolean().default(true),
});

export type BackgroundTask = z.infer<typeof BackgroundTaskSchema>;
export type Task = z.infer<typeof TaskSchema>;
export type Config = z.infer<typeof ConfigSchema>;
```

**Field semantics:**

- `command` — executed with `shell: process.platform === 'win32'` to align with `ci/run-e2e-test.ts`. Supports `&&`, pipes, env-var expansion.
- `cwd` — defaults to the orchestrator process cwd. CLI accepts `--cwd` to override.
- `env` — shallow-merged with `process.env`; user-provided keys win.
- `delayMs` — applied per-background after its own spawn; backgrounds may have different delays.
- `timeoutMs` — if exceeded, task is killed (SIGTERM → 5s → SIGKILL) and treated as failure.
- `outputDir` — created if missing. Each run produces a subdirectory `<commandId>/` (commandId = `Math.floor(Date.now() / 1000)`).
- `stopOnFailure` — when true, the first failing task triggers background cleanup and skips remaining tasks.
- `keepRawTimeline` — when false, `_timeline/` is deleted after slicing.

## Execution Flow

1. CLI parses `-f <config>` (and optional `--cwd`), loads file, runs Zod validation. **Validation failure → exit 2 with structured errors.**
2. Create `<outputDir>/<commandId>/` and `_timeline/` subdir.
3. Spawn all background tasks concurrently. Each gets a unique log file `_timeline/<bg-name>.jsonl`. Wait `max(background[*].delayMs)` before proceeding to step 4 — this is the single global readiness gate. Per-background readiness signals (HTTP, stdout pattern) are not implemented in v1; callers who need them must encode the wait into `delayMs`.
4. If any background exits (non-zero or otherwise) before step 6, kill the remaining siblings, skip all tasks, exit code 1.
5. For each task (serial):
   - `startTime = Date.now()`
   - Spawn with piped stdio, stream to `_timeline/<task-name>.jsonl`.
   - Await exit; if `timeoutMs` is set, race against a timer.
   - `endTime = Date.now()`
   - Record `{ name, exitCode, startTime, endTime }`.
   - If exit ≠ 0 and `stopOnFailure === true`: break the loop.
6. Kill all background processes (SIGTERM → wait 5s → SIGKILL stragglers).
7. For each task record, slice its window:
   - For each background: read `_timeline/<bg-name>.jsonl`, filter by `[startTime, endTime]`, write `<commandId>/<task-name>/<bg-name>.log` (plain text, message only).
   - Write `<commandId>/<task-name>/main.log` from `_timeline/<task-name>.jsonl`.
8. If `keepRawTimeline === false`: `rm -rf _timeline/`.
9. Exit code: `0` if all tasks passed, `1` otherwise.

**Timestamp authority:** All JSONL timestamps are written by the orchestrator using its own `Date.now()`. Child processes never stamp their own output — this guarantees clock consistency and prevents log injection (a child cannot forge `{"timestamp":...}` lines).

**Line buffering:** Each child's stdout/stderr is consumed via `readline`-style line buffering. Partial lines are buffered until `\n` is seen, then written with a single timestamp.

## Process Management

`process-manager.ts` reuses the proven patterns from `ci/run-e2e-test.ts`:

- `spawn(command, args, { shell: process.platform === 'win32', detached: process.platform !== 'win32', stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true })`.
- Kill on Windows: `taskkill /pid <pid> /t [/f]` for graceful / forced.
- Kill on Unix: `process.kill(-pid, signal)` against the process group created by `detached: true`, falling back to `process.kill(pid, signal)` if the group kill fails.
- Grace period: SIGTERM → wait 5s → SIGKILL.
- Orchestrator registers `SIGINT` / `SIGTERM` listeners; on receipt, run cleanup, partial-slice finished tasks, then `process.exit(130 / 143)`.

**Failure paths:**

| Trigger | Background handling | Slice output | Exit |
|---|---|---|---|
| Config validation error | n/a | none | 2 |
| Background spawn error | kill any already-spawned siblings | none | 1 |
| Background exits prematurely (before tasks run) | kill siblings in step 4 | none | 1 |
| Task exit ≠ 0, `stopOnFailure=true` | killed in step 6 | finished tasks sliced | 1 |
| Task exit ≠ 0, `stopOnFailure=false` | killed in step 6 | all tasks sliced | 1 |
| Task timeout | SIGTERM → SIGKILL the offending task only | task sliced as failure | per `stopOnFailure` |
| Orchestrator SIGINT/SIGTERM | killed in step 6 (already triggered) | finished tasks sliced | 130 / 143 |
| Orchestrator uncaught error | killed in step 6 | none | 1 |

## Output Layout

Example: config name `"e2e test"`, commandId `1719724800`, background names `[server, frontend]`, task names `[TestA.e2e.ts, TestB.e2e.ts]`:

```
artifacts/cicd/1719724800/
├── _timeline/
│   ├── server.jsonl
│   ├── frontend.jsonl
│   ├── TestA.e2e.ts.jsonl
│   └── TestB.e2e.ts.jsonl
├── TestA.e2e.ts/
│   ├── main.log
│   ├── server.log
│   └── frontend.log
└── TestB.e2e.ts/
    ├── main.log
    ├── server.log
    └── frontend.log
```

Each `.log` file is plain text — one message per line, no timestamps. This matches the convention in `artifacts/e2e/<commandId>/` used by `ci/run-e2e-test.ts`.

`_timeline/` is preserved when `keepRawTimeline=true` (default) for post-hoc re-slicing or debugging the orchestrator itself. It is deleted when `false`.

## Library API

```typescript
// src/index.ts
import type { Config } from './types.js';

export type RunOptions = {
  configPath: string;          // absolute or relative to cwd
  cwd?: string;                // default: process.cwd()
};

export type RunResult = {
  exitCode: 0 | 1;
  outputDir: string;           // absolute path to <outputDir>/<commandId>/
  taskResults: Array<{
    name: string;
    exitCode: number;
    startTime: number;
    endTime: number;
  }>;
};

export async function run(options: RunOptions): Promise<RunResult>;
```

`run()` resolves on natural completion. It does **not** call `process.exit()` — the CLI wrapper does. This keeps the library safe to use from other contexts (e.g. tests, embedding in another tool).

## CLI

```typescript
// run.ts
import { parseArgs } from 'node:util';
import { run } from './src/index.js';

const { values } = parseArgs({
  options: {
    config: { type: 'string', short: 'f' },
    cwd: { type: 'string', default: process.cwd() },
    help: { type: 'boolean', short: 'h', default: false },
  },
});

if (values.help || !values.config) {
  console.log(`Usage: bun apps/cicd/run.ts -f <config.json> [--cwd <dir>]`);
  process.exit(values.help ? 0 : 2);
}

const result = await run({
  configPath: path.resolve(values.cwd!, values.config!),
  cwd: values.cwd!,
});

process.exit(result.exitCode);
```

## Error Handling

- **Validation errors** are printed in Zod's structured form (path + message + code) and the process exits with code 2.
- **Spawn failures** (ENOENT, EACCES) are surfaced with command name, attempted argv, and the OS error message.
- **Task timeouts** cancel the timeout, send SIGTERM to the task child, then SIGKILL after 5s. The task is recorded with `exitCode: -1` and a `timedOut: true` flag.
- **Partial runs** (some tasks finished before stopOnFailure or signal): finished tasks are sliced; unfinished tasks have no output directory.
- **Cleanup is best-effort but guaranteed** via `process.on('exit')` fallback that does not await (kills what it can synchronously).

## Testing Strategy

**Unit tests** (`test/*.test.ts`, runner: Bun:test for zero-config):
- `config.test.ts`: valid configs pass; missing `tasks`, negative `delayMs`, empty `name`, etc. fail with specific error paths.
- `log-store.test.ts`: lines preserve order, partial chunks are buffered, timestamps are monotonically non-decreasing.
- `slicer.test.ts`: empty range yields empty output; range crossing a record filters correctly; out-of-range records excluded; malformed JSONL lines skipped with warning.

**Integration tests** (`test/integration.test.ts`, real child processes via Bun:test):
- **Happy path:** one background (`node -e "setInterval(()=>console.log('tick'),50)"`) + one task (`echo done`) with `delayMs: 200`. Assert output structure, file contents, exit code 0.
- **Multi-task:** two tasks sharing the same background; assert each gets its own slice window.
- **Failure + stopOnFailure:** task `false` (exit 1) with `stopOnFailure: true`. Assert second task not run, background cleaned up, exit code 1.
- **Failure + !stopOnFailure:** same as above with `stopOnFailure: false`. Assert second task still runs, both sliced, exit code 1.
- **Timeout:** task `sleep 10` with `timeoutMs: 200`. Assert killed within ~5s, recorded as timed out.
- **Signal:** spawn orchestrator as subprocess, send SIGTERM mid-run, assert exit code 143 and partial slices.

All integration tests use `tmpdir()` for `outputDir` to avoid polluting the repo.

## Out of Scope (v1)

- Concurrent task execution
- Readiness checks other than `delayMs` (no `http()`, no `logMatch()`)
- Real-time log fan-out to multiple sinks
- Log rotation, size limits, or compression
- TUI / live tail
- Per-step retry logic
- Config includes / imports
- Schema for environment variable declarations beyond `env: Record<string, string>`

## Open Questions

None at design time. All ambiguities in `design.md` (timestamp source, output fan-out mapping, error semantics) were resolved during brainstorming (2026-06-30).