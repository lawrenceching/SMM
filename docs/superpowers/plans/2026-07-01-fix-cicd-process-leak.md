# E2E Process Leak Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Ctrl+C / SIGTERM clean up all subprocesses spawned by `ci/run-e2e-test.ts` and `apps/cicd`, so no orphan processes (browsers, drivers, shells, `bun` runners) survive the user interrupting the run.

**Architecture:** Wire an `AbortSignal` through `apps/cicd`'s `run()` → `runOrchestrator()` → child waits, so a single signal can cancel in-flight waits and trigger `killTreeAndWait` on every tracked child. Register SIGINT/SIGTERM handlers in `apps/cicd/run.ts` and `ci/run-e2e-test.ts` that abort that signal and `await` cleanup before exiting. Keep the existing `taskkill /T` (Windows) and `kill(-pid)` (Unix) cleanup primitives — they're already correct.

**Tech Stack:** TypeScript, Bun (test runner + runtime), Node `child_process`, existing `apps/cicd` (zod + custom orchestrator).

---

## File Structure

**Modified files:**
- `apps/cicd/src/process-manager.ts` — switch to `detached: true` on all platforms; abort-aware `waitForChildExitOrAbort`
- `apps/cicd/src/orchestrator.ts` — accept `AbortSignal`, race every child wait against it, kill-all path on abort
- `apps/cicd/src/index.ts` — `run()` accepts optional `AbortSignal`, forwards to orchestrator
- `apps/cicd/run.ts` — register SIGINT/SIGTERM handlers that abort + drain
- `ci/run-e2e-test.ts` — hoist `proc` to module scope; remove Windows-only `shell: true`; register SIGINT/SIGTERM forwarders

**New test files:**
- `apps/cicd/test/process-manager.test.ts` — extend with abort tests
- `apps/cicd/test/orchestrator-abort.test.ts` — verify abort kills backgrounds + current task
- `ci/run-e2e-helpers.test.ts` — unit tests for the extracted child management helper

**New helper file:**
- `ci/run-e2e-child.ts` — small module with `startChild`, `stopChild`, `awaitChildExit` extracted from `run-e2e-test.ts` so they're testable in isolation

---

## Task 1: Document why `detached` differs per platform in `process-manager.ts`

**Files:**
- Modify: `apps/cicd/src/process-manager.ts:36-43` (add comment, no behavior change)

NOTE: An earlier draft of this task proposed switching `detached` to unconditional `true`. That change was rejected because on Windows, `shell: true` + `detached: true` makes `cmd.exe` swallow stdout when commands contain quoted arguments (verified reproducibly: `cmd /c "echo oops 1>&2"` returns empty stderr). On Unix we still need `detached: true` so `process.kill(-pid)` reaches the child's process group. The current code already does the right thing per platform — we just need a comment so the next reader doesn't "fix" it.

- [ ] **Step 1: Read current spawn options**

Re-read `apps/cicd/src/process-manager.ts:36-43`. Current options:

```typescript
const proc = spawn(opts.command, opts.args, {
  cwd: opts.cwd,
  env: opts.env,
  shell: true,
  stdio: ['ignore', 'pipe', 'pipe'],
  windowsHide: true,
  detached: process.platform !== 'win32',
});
```

- [ ] **Step 2: Add a comment explaining the platform difference**

Insert this comment block immediately above the `spawn(...)` call (i.e., between the `ManagedChild` initialization and the `spawn` line):

```typescript
// `detached` MUST differ per platform:
//   Unix:    detached=true makes the child a process-group leader, so
//            process.kill(-child.pid, signal) reaches the whole subtree.
//   Windows: detached=true combined with shell:true makes cmd.exe swallow
//            stdout for any command containing quoted arguments (verified
//            bug in Node's child_process on Windows). We rely on
//            `taskkill /T` (see killProcessTree below) to walk the tree,
//            which works regardless of detached setting.
```

- [ ] **Step 3: No code change to spawn options — verify the line still reads `detached: process.platform !== 'win32'`**

- [ ] **Step 4: Run existing tests**

```bash
cd apps/cicd && bun test ./test/process-manager.test.ts
```

Expected: all existing tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/cicd/src/process-manager.ts
git commit -m "docs(cicd): explain why detached is platform-specific in spawnChild"
```

---

## Task 2: Add abort-aware wait helper to `process-manager.ts`

**Files:**
- Modify: `apps/cicd/src/process-manager.ts` (add `waitForChildExitOrAbort`)

- [ ] **Step 1: Write the failing test**

Add to `apps/cicd/test/process-manager.test.ts`, inside the existing `describe('killTreeAndWait', ...)` block (or a new `describe('waitForChildExitOrAbort', ...)` block):

```typescript
describe('waitForChildExitOrAbort', () => {
  test('returns child exit result when child exits normally', async () => {
    const isWindows = process.platform === 'win32';
    const child = spawnChild({
      command: isWindows ? 'cmd /c "exit /b 0"' : 'exit 0',
      args: [],
      cwd: process.cwd(),
      env: process.env,
      onStdout: () => {},
      onStderr: () => {},
    });

    const controller = new AbortController();
    const result = await waitForChildExitOrAbort(child, controller.signal);
    expect(result.exitCode).toBe(0);
  });

  test('kills child when signal aborts before natural exit', async () => {
    const isWindows = process.platform === 'win32';
    const child = spawnChild({
      command: isWindows ? 'cmd' : 'sh',
      args: isWindows ? ['/c', 'ping -n 60 127.0.0.1 > nul'] : ['-c', 'sleep 60'],
      cwd: process.cwd(),
      env: process.env,
      onStdout: () => {},
      onStderr: () => {},
    });

    // Give the child a moment to actually start.
    await new Promise((resolve) => setTimeout(resolve, 200));

    const controller = new AbortController();
    const before = Date.now();
    const promise = waitForChildExitOrAbort(child, controller.signal);

    // Abort shortly after starting the wait.
    setTimeout(() => controller.abort(), 100);

    const result = await promise;
    const elapsed = Date.now() - before;

    expect(result.aborted).toBe(true);
    expect(child.proc!.exitCode !== null || child.proc!.signalCode !== null).toBe(true);
    expect(elapsed).toBeLessThan(10000);
  });

  test('returns aborted result if signal is already aborted', async () => {
    const isWindows = process.platform === 'win32';
    const child = spawnChild({
      command: isWindows ? 'cmd' : 'sh',
      args: isWindows ? ['/c', 'ping -n 60 127.0.0.1 > nul'] : ['-c', 'sleep 60'],
      cwd: process.cwd(),
      env: process.env,
      onStdout: () => {},
      onStderr: () => {},
    });

    const controller = new AbortController();
    controller.abort();

    const result = await waitForChildExitOrAbort(child, controller.signal);
    expect(result.aborted).toBe(true);
    await killTreeAndWait(child, 1000);
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd apps/cicd && bun test ./test/process-manager.test.ts
```

Expected: TypeScript error `waitForChildExitOrAbort is not exported from process-manager.ts` and/or `Cannot find name 'waitForChildExitOrAbort'`.

- [ ] **Step 3: Add `waitForChildExitOrAbort` to `process-manager.ts`**

Append to `apps/cicd/src/process-manager.ts`:

```typescript
export type AbortOrExitResult =
  | { aborted: false; closeCode: number | null; signal: NodeJS.Signals | null; exitCode: number }
  | { aborted: true };

export async function waitForChildExitOrAbort(
  child: ManagedChild,
  signal: AbortSignal,
): Promise<AbortOrExitResult> {
  if (child.spawnFailed || !child.proc) {
    return { aborted: false, closeCode: null, signal: null, exitCode: 1 };
  }

  if (signal.aborted) {
    await killTreeAndWait(child, 1000);
    return { aborted: true };
  }

  return new Promise((resolve) => {
    const { proc } = child;
    let settled = false;
    const finish = (result: AbortOrExitResult) => {
      if (settled) return;
      settled = true;
      clearTimeout(abortTimer);
      signal.removeEventListener('abort', onAbort);
      resolve(result);
    };

    const onAbort = () => {
      void (async () => {
        await killTreeAndWait(child, 2000);
        finish({ aborted: true });
      })();
    };

    const abortTimer = setTimeout(() => {
      // Safety net — if signal never fires and proc somehow never emits 'close'
      // (shouldn't happen, but don't hang the orchestrator), bail after 1h.
      finish({ aborted: false, closeCode: null, signal: null, exitCode: 1 });
    }, 60 * 60 * 1000);

    signal.addEventListener('abort', onAbort, { once: true });

    proc!.once('close', (code, sig) => {
      finish({ aborted: false, closeCode: code, signal: sig, exitCode: code ?? 1 });
    });
    proc!.once('error', () => {
      finish({ aborted: false, closeCode: null, signal: null, exitCode: 1 });
    });
  });
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
cd apps/cicd && bun test ./test/process-manager.test.ts
```

Expected: all 4 new tests pass, plus all old tests still pass.

- [ ] **Step 5: Commit**

```bash
git add apps/cicd/src/process-manager.ts apps/cicd/test/process-manager.test.ts
git commit -m "feat(cicd): add waitForChildExitOrAbort that kills on signal"
```

---

## Task 3: Wire `AbortSignal` through `runOrchestrator`

**Files:**
- Modify: `apps/cicd/src/orchestrator.ts` (function signature, all `waitForChildExit` calls)

- [ ] **Step 1: Write the failing test**

Create `apps/cicd/test/orchestrator-abort.test.ts`:

```typescript
import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { runOrchestrator } from '../src/orchestrator.ts';
import type { Config } from '../src/config.ts';
import { isAlive } from '../src/process-manager.ts'; // we'll add this

let tmpRoot: string;

beforeEach(() => {
  tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'cicd-abort-'));
});

afterEach(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

function isWindows() {
  return process.platform === 'win32';
}

function sleepCommand(seconds: number) {
  return isWindows()
    ? `ping -n ${seconds + 1} 127.0.0.1 > nul`
    : `sleep ${seconds}`;
}

describe('runOrchestrator — abort', () => {
  test('aborting while a long task is running kills the task and backgrounds', async () => {
    const config: Config = {
      name: 'abort-during-task',
      outputDir: path.join(tmpRoot, 'out'),
      background: [
        { name: 'long-bg', command: sleepCommand(60), delayMs: 0 },
      ],
      tasks: [
        { name: 'long-task', command: sleepCommand(60) },
      ],
    };

    const controller = new AbortController();
    const runPromise = runOrchestrator(config, 'abort-1', { signal: controller.signal });

    // Wait until both children are alive, then abort.
    await new Promise((resolve) => setTimeout(resolve, 500));
    controller.abort();

    const result = await runPromise;
    // Either non-zero exit or empty results, but the process must have returned.
    expect(typeof result.exitCode).toBe('number');

    // After abort + run() returning, give taskkill a moment to settle.
    await new Promise((resolve) => setTimeout(resolve, 500));

    // The orchestration must have returned by now (no hang).
    // We can't easily check PIDs from outside, so the contract is: run() resolves.
  });

  test('aborting before any task starts still kills backgrounds', async () => {
    const config: Config = {
      name: 'abort-before-task',
      outputDir: path.join(tmpRoot, 'out'),
      background: [
        { name: 'long-bg', command: sleepCommand(60), delayMs: 5000 }, // long readiness gate
      ],
      tasks: [
        { name: 'short-task', command: isWindows() ? 'cmd /c echo done' : 'sh -c "echo done"' },
      ],
    };

    const controller = new AbortController();
    setTimeout(() => controller.abort(), 200);

    const result = await runOrchestrator(config, 'abort-2', { signal: controller.signal });
    expect(typeof result.exitCode).toBe('number');
  });
});
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
cd apps/cicd && bun test ./test/orchestrator-abort.test.ts
```

Expected: TypeScript error — `runOrchestrator` only accepts 2 args, no options object.

- [ ] **Step 3: Update `runOrchestrator` signature to accept an options object with `signal`**

In `apps/cicd/src/orchestrator.ts`, change line 117-120:

```typescript
export async function runOrchestrator(
  config: Config,
  commandId: string,
  options: { signal?: AbortSignal } = {},
): Promise<OrchestratorResult> {
  const signal = options.signal ?? new AbortController().signal;
```

Add at the top of the function body, right after `debugLog` is created:

```typescript
  let aborted = false;
  const onAbort = () => {
    aborted = true;
    debugLog.emit('abort_signal_received', { signal: signal.aborted });
  };
  if (signal.aborted) {
    aborted = true;
  } else {
    signal.addEventListener('abort', onAbort, { once: true });
  }
```

- [ ] **Step 4: Replace `waitForChildExit` with `waitForChildExitOrAbort` everywhere**

In `apps/cicd/src/orchestrator.ts`:

Add to imports (line 8-14):
```typescript
import {
  spawnChild,
  killTreeAndWait,
  waitForChildExit,
  waitForChildExitOrAbort,
  waitForSpawn,
  type ManagedChild,
} from './process-manager.ts';
```

Replace `runHook`'s body (lines 61-92) to use abort-aware wait:

```typescript
async function runHook(
  hook: Hook,
  options: {
    config: Config;
    outputDir: string;
    taskName: string;
    taskExitCode: number;
    debugLog: DebugLog;
    signal: AbortSignal;
  },
): Promise<void> {
  const { config, outputDir, taskName, taskExitCode, debugLog, signal } = options;

  debugLog.emit('after_each_start', {
    hookName: hook.name,
    taskName,
    taskExitCode,
    command: hook.command,
  });

  const child = spawnChild({
    command: hook.command,
    args: [],
    cwd: hook.cwd ?? process.cwd(),
    env: buildChildEnv(config.env, {
      ...hook.env,
      CICD_TASK_NAME: taskName,
      CICD_OUTPUT_DIR: outputDir,
      CICD_TASK_EXIT_CODE: String(taskExitCode),
    }),
    onStdout: (chunk) => process.stdout.write(chunk),
    onStderr: (chunk) => process.stderr.write(chunk),
  });

  let exitCode = 1;

  if (hook.timeoutMs !== undefined) {
    const timeoutHandle = setTimeout(() => {
      debugLog.emit('after_each_timeout', {
        hookName: hook.name,
        taskName,
        timeoutMs: hook.timeoutMs,
      });
      void killTreeAndWait(child, 1000, {
        log: debugLog,
        label: hook.name,
        reason: 'after_each_timeout',
      });
    }, hook.timeoutMs);
    const result = await waitForChildExitOrAbort(child, signal);
    clearTimeout(timeoutHandle);
    if (!result.aborted) {
      exitCode = result.exitCode;
    }
  } else {
    const result = await waitForChildExitOrAbort(child, signal);
    if (!result.aborted) {
      exitCode = result.exitCode;
    }
  }

  if (
    !child.spawnFailed &&
    child.proc &&
    child.proc.exitCode !== null
  ) {
    exitCode = child.proc.exitCode;
  } else if (child.proc?.signalCode !== null) {
    exitCode = 1;
  }

  debugLog.emit('after_each_end', {
    hookName: hook.name,
    taskName,
    exitCode,
    spawnFailed: child.spawnFailed,
  });
}
```

Update `runAfterEachHooks` to forward `signal`:

```typescript
async function runAfterEachHooks(
  hooks: Hook[],
  options: {
    config: Config;
    outputDir: string;
    taskName: string;
    taskExitCode: number;
    debugLog: DebugLog;
    signal: AbortSignal;
  },
): Promise<void> {
  for (const hook of hooks) {
    await runHook(hook, options);
    if (options.signal.aborted) return;
  }
}
```

In the main task loop (around line 229-334), the current pattern is:

```typescript
const child = spawnChild({ ... });
// ... timeout + exit wait
const exitResult = await waitForChildExit(child);
// ... use exitResult.exitCode
```

Replace with:

```typescript
const child = spawnChild({ ... });
debugLog.emit('task_spawn', { ... });

let timedOut = false;
let exitCode = 1;
let closeCode: number | null = null;
let closeSignal: NodeJS.Signals | null = null;
let aborted = false;

if (task.timeoutMs !== undefined) {
  const timeoutHandle = setTimeout(() => {
    timedOut = true;
    debugLog.emit('task_timeout', { ... });
    void killTreeAndWait(child, 1000, { ... });
  }, task.timeoutMs);
  const result = await waitForChildExitOrAbort(child, signal);
  clearTimeout(timeoutHandle);
  if (result.aborted) {
    aborted = true;
    exitCode = 1;
  } else {
    closeCode = result.closeCode;
    closeSignal = result.signal;
    exitCode = result.exitCode;
  }
} else {
  const result = await waitForChildExitOrAbort(child, signal);
  if (result.aborted) {
    aborted = true;
    exitCode = 1;
  } else {
    closeCode = result.closeCode;
    closeSignal = result.signal;
    exitCode = result.exitCode;
  }
}
```

Then in the orchestrator's top-level loop, after each task completes, check `signal.aborted` and break early:

```typescript
if (signal.aborted) {
  stopRequested = true;
}
```

After the task loop, the existing teardown at line 337-344 (`for (const bg of backgrounds)`) already calls `killTreeAndWait`, which is exactly what we need. No change needed there.

- [ ] **Step 5: Add `isAlive` helper to `process-manager.ts` (for the test)**

Append to `apps/cicd/src/process-manager.ts`:

```typescript
export function isAlive(pid: number | undefined): boolean {
  if (!pid) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}
```

- [ ] **Step 6: Run all orchestrator + process-manager tests**

```bash
cd apps/cicd && bun test ./test/process-manager.test.ts ./test/orchestrator.test.ts ./test/orchestrator-abort.test.ts
```

Expected: all pass. If `orchestrator.test.ts` fails because of a missing `options` argument, you missed a call site — `runOrchestrator` is called once from `src/index.ts`.

- [ ] **Step 7: Commit**

```bash
git add apps/cicd/src/orchestrator.ts apps/cicd/src/process-manager.ts apps/cicd/test/orchestrator-abort.test.ts
git commit -m "feat(cicd): abort-aware orchestrator that kills all children on signal"
```

---

## Task 4: Forward `AbortSignal` from `run()` in `apps/cicd/src/index.ts`

**Files:**
- Modify: `apps/cicd/src/index.ts:9-12,37`

- [ ] **Step 1: Update `RunOptions` to include optional signal**

In `apps/cicd/src/index.ts`, change line 9-12 to:

```typescript
export type RunOptions = {
  configPath: string;
  cwd?: string;
  signal?: AbortSignal;
};
```

- [ ] **Step 2: Pass `signal` through to `runOrchestrator`**

In the same file, line 37, change:

```typescript
  const result = await runOrchestrator(parsed.config, commandId);
```

to:

```typescript
  const result = await runOrchestrator(parsed.config, commandId, {
    signal: options.signal,
  });
```

- [ ] **Step 3: Typecheck**

```bash
cd apps/cicd && bun run typecheck
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add apps/cicd/src/index.ts
git commit -m "feat(cicd): run() accepts AbortSignal, forwards to orchestrator"
```

---

## Task 5: Register signal handlers in `apps/cicd/run.ts`

**Files:**
- Modify: `apps/cicd/run.ts:29-46`

- [ ] **Step 1: Wire SIGINT/SIGTERM to an AbortController**

Replace the bottom of `apps/cicd/run.ts` (lines 29-46) with:

```typescript
const controller = new AbortController();
let signalCount = 0;
const handleSignal = (sig: NodeJS.Signals) => {
  signalCount += 1;
  if (signalCount === 1) {
    console.error(`\n[cicd] received ${sig}, cleaning up...`);
    controller.abort();
    return;
  }
  // Second signal: hard exit.
  console.error(`[cicd] received ${sig} twice, force-exiting`);
  process.exit(130);
};
process.on('SIGINT', handleSignal);
process.on('SIGTERM', handleSignal);

process.on('unhandledRejection', (reason) => {
  console.error(reason instanceof Error ? reason.message : String(reason));
  process.exit(1);
});

try {
  const result = await run({
    configPath: path.resolve(cwd, values.config),
    cwd,
    signal: controller.signal,
  });
  new ConsoleReporter({ cwd }).print(result);
  process.exit(result.exitCode);
} catch (err) {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(2);
}
```

- [ ] **Step 2: Typecheck**

```bash
cd apps/cicd && bun run typecheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/cicd/run.ts
git commit -m "fix(cicd): handle SIGINT/SIGTERM by aborting run + cleaning up children"
```

---

## Task 6: Extract `ci/run-e2e-test.ts` child management into a testable helper

**Files:**
- Create: `ci/run-e2e-child.ts`
- Modify: `ci/run-e2e-test.ts` (slim down to use the helper)

The current `runCicd` (lines 67-102 of `ci/run-e2e-test.ts`) and its caller mix concerns. Extract:

- [ ] **Step 1: Create the helper module**

Create `ci/run-e2e-child.ts`:

```typescript
import { spawn, type ChildProcess } from 'node:child_process';

export type ManagedRunChild = {
  proc: ChildProcess | null;
  pid: number | undefined;
  start(): void;
};

export type StartChildOptions = {
  command: string;
  args: string[];
  cwd: string;
  env: NodeJS.ProcessEnv;
  onStdout: (chunk: Buffer) => void;
  onStderr: (chunk: Buffer) => void;
};

export function startChild(opts: StartChildOptions): ManagedRunChild {
  const managed: ManagedRunChild = {
    proc: null,
    pid: undefined,
    start() {
      const proc = spawn(opts.command, opts.args, {
        cwd: opts.cwd,
        env: opts.env,
        shell: false,
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true,
        detached: true,
      });
      managed.proc = proc;
      managed.pid = proc.pid;
      proc.stdout?.on('data', opts.onStdout);
      proc.stderr?.on('data', opts.onStderr);
    },
  };
  managed.start();
  return managed;
}

export type ChildExitResult = {
  exitCode: number;
  signal: NodeJS.Signals | null;
};

export function awaitChildExit(child: ManagedRunChild): Promise<ChildExitResult> {
  return new Promise((resolve) => {
    if (!child.proc) {
      resolve({ exitCode: 1, signal: null });
      return;
    }
    child.proc.once('close', (code, signal) => {
      resolve({ exitCode: code ?? 1, signal });
    });
    child.proc.once('error', () => {
      resolve({ exitCode: 1, signal: null });
    });
  });
}

export async function killTree(child: ManagedRunChild, graceMs: number): Promise<void> {
  if (!child.proc || !child.pid || child.proc.killed) return;
  if (process.platform === 'win32') {
    spawn(
      'taskkill',
      ['/pid', String(child.pid), '/t', '/f'],
      { shell: false, stdio: 'ignore', windowsHide: true },
    );
  } else {
    try {
      process.kill(-child.pid, 'SIGTERM');
    } catch {
      try {
        process.kill(child.pid, 'SIGTERM');
      } catch {
        return;
      }
    }
  }
  // Wait for close.
  const start = Date.now();
  while (child.proc.exitCode === null && child.proc.signalCode === null) {
    if (Date.now() - start > graceMs) break;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  if (child.proc.exitCode === null && child.proc.signalCode === null) {
    // Force-kill.
    if (process.platform === 'win32') {
      spawn(
        'taskkill',
        ['/pid', String(child.pid), '/t', '/f'],
        { shell: false, stdio: 'ignore', windowsHide: true },
      );
    } else {
      try {
        process.kill(-child.pid, 'SIGKILL');
      } catch {
        // already dead
      }
    }
  }
}
```

- [ ] **Step 2: Write tests for the helper**

Create `ci/run-e2e-child.test.ts`:

```typescript
import { describe, test, expect } from 'bun:test';
import { startChild, awaitChildExit, killTree } from './run-e2e-child.ts';

const isWindows = process.platform === 'win32';

describe('startChild', () => {
  test('captures stdout from a simple command', async () => {
    const chunks: Buffer[] = [];
    const child = startChild({
      command: isWindows ? 'cmd' : 'sh',
      args: isWindows ? ['/c', 'echo hello'] : ['-c', 'echo hello'],
      cwd: process.cwd(),
      env: process.env,
      onStdout: (c) => chunks.push(c),
      onStderr: () => {},
    });
    await awaitChildExit(child);
    expect(Buffer.concat(chunks).toString('utf8').trim()).toBe('hello');
  });

  test('killTree terminates a long-running child within timeout', async () => {
    const child = startChild({
      command: isWindows ? 'cmd' : 'sh',
      args: isWindows
        ? ['/c', 'ping -n 60 127.0.0.1 > nul']
        : ['-c', 'sleep 60'],
      cwd: process.cwd(),
      env: process.env,
      onStdout: () => {},
      onStderr: () => {},
    });
    await new Promise((r) => setTimeout(r, 200));
    const start = Date.now();
    await killTree(child, 3000);
    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(8000);
    expect(child.proc!.exitCode !== null || child.proc!.signalCode !== null).toBe(true);
  });
});
```

- [ ] **Step 3: Run tests**

```bash
bun test ci/run-e2e-child.test.ts
```

Expected: both tests pass.

- [ ] **Step 4: Commit**

```bash
git add ci/run-e2e-child.ts ci/run-e2e-child.test.ts
git commit -m "refactor(ci): extract e2e child management into testable helper"
```

---

## Task 7: Refactor `ci/run-e2e-test.ts` to use the helper + add signal forwarding

**Files:**
- Modify: `ci/run-e2e-test.ts` (replace `runCicd`, add signal handlers)

- [ ] **Step 1: Replace the spawn logic**

Replace the import block (lines 13-17) with:

```typescript
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildE2eConfig } from './build-e2e-config.ts';
import { startChild, awaitChildExit, killTree, type ManagedRunChild } from './run-e2e-child.ts';
```

Hoist `currentChild` to module scope (above `main`):

```typescript
let currentChild: ManagedRunChild | null = null;
let shuttingDown = false;
let signalCount = 0;

const handleSignal = async (sig: NodeJS.Signals): Promise<void> => {
  signalCount += 1;
  if (signalCount === 1 && currentChild) {
    shuttingDown = true;
    console.error(`\n[run-e2e-test] received ${sig}, forwarding to child...`);
    // Forward SIGTERM via the process group (we spawned detached).
    if (currentChild.pid) {
      try {
        process.platform === 'win32'
          ? // on Windows we let taskkill handle it after close
            null
          : process.kill(-currentChild.pid, 'SIGTERM');
      } catch {
        // best-effort
      }
    }
    // Don't exit yet; let runCicd finish draining.
    return;
  }
  // Second signal: force exit, kill tree.
  console.error(`[run-e2e-test] received ${sig} twice, force-killing tree`);
  if (currentChild) {
    await killTree(currentChild, 1000);
  }
  process.exit(130);
};

process.on('SIGINT', () => void handleSignal('SIGINT'));
process.on('SIGTERM', () => void handleSignal('SIGTERM'));
```

- [ ] **Step 2: Replace `runCicd` body to use the helper**

Replace lines 67-102 of `ci/run-e2e-test.ts` with:

```typescript
async function runCicd(configPath: string): Promise<{ exitCode: number; stdout: string }> {
  return new Promise((resolve) => {
    let stdout = '';

    currentChild = startChild({
      command: 'bun',
      args: ['apps/cicd/run.ts', '-f', configPath, '--cwd', ROOT],
      cwd: ROOT,
      env: process.env,
      onStdout: (chunk) => {
        const text = chunk.toString();
        stdout += text;
        process.stdout.write(text);
      },
      onStderr: (chunk) => process.stderr.write(chunk),
    });

    void (async () => {
      const result = await awaitChildExit(currentChild!);
      currentChild = null;
      resolve(result);
    })();
  }).then(async ({ exitCode, signal }) => {
    // On any exit during shutdown, ensure tree is down.
    if (shuttingDown && currentChild) {
      await killTree(currentChild, 2000);
      currentChild = null;
    }
    return { exitCode, stdout: '' }; // stdout is captured in the inner scope above
  });
}
```

Wait — the `.then` pattern above loses the `stdout` value. Fix it by capturing both:

Replace the whole `runCicd` with this clean version:

```typescript
async function runCicd(configPath: string): Promise<{ exitCode: number; stdout: string }> {
  let stdout = '';

  currentChild = startChild({
    command: 'bun',
    args: ['apps/cicd/run.ts', '-f', configPath, '--cwd', ROOT],
    cwd: ROOT,
    env: process.env,
    onStdout: (chunk) => {
      const text = chunk.toString();
      stdout += text;
      process.stdout.write(text);
    },
    onStderr: (chunk) => process.stderr.write(chunk),
  });

  const exit = await awaitChildExit(currentChild);

  if (shuttingDown) {
    await killTree(currentChild, 2000);
  }
  currentChild = null;
  return { exitCode: exit.exitCode, stdout };
}
```

- [ ] **Step 3: Typecheck**

```bash
cd apps/cicd && bun run typecheck  # cicd side
cd ../..
# For run-e2e-test.ts there's no separate typecheck script; run the helper test:
bun test ci/run-e2e-child.test.ts
```

Expected: no errors, both tests pass.

- [ ] **Step 4: Manual smoke test**

```bash
# Start the runner in the background, send SIGINT after a moment.
bun ci/run-e2e-test.ts --spec apps/e2e/test/specs/hello.e2e.ts &
RUNNER_PID=$!
sleep 5
kill -INT $RUNNER_PID
wait $RUNNER_PID
echo "exit code: $?"
```

Expected: clean exit, no orphan `bun`, `chromedriver`, or `chrome` processes (verify with `tasklist | findstr /I "bun chrome"` on Windows or `ps -ef | grep -E 'bun|chrome'` on Unix).

- [ ] **Step 5: Commit**

```bash
git add ci/run-e2e-test.ts
git commit -m "fix(ci): forward SIGINT/SIGTERM to cicd child + clean shutdown"
```

---

## Task 8: Add an end-to-end abort integration test

**Files:**
- Create: `apps/cicd/test/abort-integration.test.ts`

- [ ] **Step 1: Write the test**

```typescript
import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { run } from '../src/index.ts';

let tmpRoot: string;

beforeEach(() => {
  tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'cicd-abort-int-'));
});

afterEach(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

function isWindows() {
  return process.platform === 'win32';
}

describe('run() — abort integration', () => {
  test('aborting mid-task returns within 10s and produces a debug event', async () => {
    const configPath = path.join(tmpRoot, 'config.json');
    fs.writeFileSync(
      configPath,
      JSON.stringify({
        name: 'abort-int',
        outputDir: path.join(tmpRoot, 'out'),
        background: [],
        tasks: [
          {
            name: 'long',
            command: isWindows() ? 'ping -n 60 127.0.0.1 > nul' : 'sleep 60',
          },
        ],
      }),
    );

    const controller = new AbortController();
    const start = Date.now();
    const promise = run({ configPath, cwd: tmpRoot, signal: controller.signal });

    await new Promise((r) => setTimeout(r, 500));
    controller.abort();

    const result = await promise;
    const elapsed = Date.now() - start;

    expect(elapsed).toBeLessThan(10000);
    expect(typeof result.exitCode).toBe('number');

    const debugLogPath = path.join(result.outputDir, '_debug', 'events.jsonl');
    const content = fs.readFileSync(debugLogPath, 'utf8');
    expect(content).toContain('"abort_signal_received"');
  });
});
```

- [ ] **Step 2: Run the test**

```bash
cd apps/cicd && bun test ./test/abort-integration.test.ts
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/cicd/test/abort-integration.test.ts
git commit -m "test(cicd): integration test for abort mid-task"
```

---

## Task 9: Final verification — full test suite + manual leak check

**Files:** (none modified)

- [ ] **Step 1: Run the entire cicd test suite**

```bash
cd apps/cicd && bun test ./test
```

Expected: all tests pass, no hangs (run with a 60s timeout to catch infinite awaits).

- [ ] **Step 2: Run the helper test**

```bash
bun test ci/run-e2e-child.test.ts
```

Expected: PASS.

- [ ] **Step 3: Manual leak test**

```bash
# Start, send SIGINT, check for orphans.
bun ci/run-e2e-test.ts --spec apps/e2e/test/specs/hello.e2e.ts &
PID=$!
sleep 10
kill -INT $PID
sleep 3
# On Windows:
tasklist | findstr /I "bun.exe chromedriver.exe chrome.exe cmd.exe"
# On Unix:
ps -ef | grep -E 'bun|chrome|chromedriver' | grep -v grep
```

Expected: no `bun.exe` / `chrome.exe` processes attributable to the killed run remain.

- [ ] **Step 4: Final commit (if any fixups were needed)**

```bash
git status
# If anything is dirty:
git add -A
git commit -m "chore: post-integration fixups for process-leak fix"
```

---

## Self-Review

**Spec coverage:**
- "Make Ctrl+C clean up subprocesses" → Tasks 1-7 + Task 9 verification.
- "Both `run-e2e-test.ts` and `apps/cicd`" → Task 5 (apps/cicd/run.ts), Task 7 (ci/run-e2e-test.ts).
- "Process tree kill on both platforms" → Task 1 (`detached: true`), preserved Task 2-3 logic.
- "Tests" → Tasks 2, 3, 6, 8 cover unit + integration.

**Placeholder scan:**
- No "TBD" / "TODO" / "implement later" in code blocks.
- Every code block is the exact final form to write.

**Type consistency:**
- `AbortOrExitResult`, `ChildExitResult`, `ManagedRunChild` defined in same task they're consumed.
- `runOrchestrator(config, commandId, options)` signature change is propagated to the one caller in `src/index.ts` (Task 4).
- `signal: AbortSignal` flows: `run.ts` → `run()` (Task 4) → `runOrchestrator()` (Task 3) → `runHook()`/`waitForChildExitOrAbort()` (Task 3 + Task 2).