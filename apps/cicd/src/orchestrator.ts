import * as fs from 'node:fs';
import * as path from 'node:path';
import type { Config, Hook } from './config.ts';
import type { TaskRecord } from './types.ts';
import { DebugLog } from './debug-log.ts';
import { LogStore } from './log-store.ts';
import { sliceLogFile } from './slicer.ts';
import {
  spawnChild,
  killTreeAndWait,
  waitForChildExitOrAbort,
  waitForSpawn,
  type ManagedChild,
} from './process-manager.ts';

export interface OrchestratorResult {
  exitCode: 0 | 1;
  taskResults: TaskRecord[];
}

function buildChildEnv(
  configEnv: Record<string, string> | undefined,
  itemEnv: Record<string, string> | undefined,
): NodeJS.ProcessEnv {
  return { ...process.env, ...configEnv, ...itemEnv };
}

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

export async function runOrchestrator(
  config: Config,
  commandId: string,
  options: { signal?: AbortSignal } = {},
): Promise<OrchestratorResult> {
  const signal = options.signal ?? new AbortController().signal;
  const outputDir = path.resolve(config.outputDir, String(commandId));
  const timelineDir = path.join(outputDir, '_timeline');
  fs.mkdirSync(timelineDir, { recursive: true });

  const debugLog = DebugLog.forOutputDir(outputDir);
  debugLog.emit('run_start', {
    commandId,
    outputDir,
    platform: process.platform,
    nodePid: process.pid,
    ppid: process.ppid,
    taskCount: config.tasks.length,
    backgroundCount: config.background.length,
    stopOnFailure: config.stopOnFailure,
  });

  // Emit a debug event so operators can see when an abort signal arrived.
  if (signal.aborted) {
    debugLog.emit('abort_signal_received', { reason: 'pre-aborted' });
  } else {
    signal.addEventListener('abort', () => {
      debugLog.emit('abort_signal_received', { reason: 'listener' });
    }, { once: true });
  }

  const logStore = new LogStore(timelineDir);

  // Register sources for all backgrounds and tasks up front so order is stable.
  for (const bg of config.background) {
    logStore.registerSource(bg.name);
  }
  for (const task of config.tasks) {
    logStore.registerSource(task.name);
  }

  // Spawn backgrounds.
  const backgrounds: ManagedChild[] = [];
  for (const bg of config.background) {
    const child = spawnChild({
      command: bg.command,
      args: [],
      cwd: bg.cwd ?? process.cwd(),
      env: buildChildEnv(config.env, bg.env),
      onStdout: (chunk) => logStore.appendChunk(bg.name, 'stdout', chunk),
      onStderr: (chunk) => logStore.appendChunk(bg.name, 'stderr', chunk),
    });
    backgrounds.push(child);

    debugLog.emit('background_spawn', {
      name: bg.name,
      pid: child.pid ?? null,
      spawnFailed: child.spawnFailed,
      cwd: bg.cwd ?? process.cwd(),
      command: bg.command,
      delayMs: bg.delayMs ?? 0,
    });

    if (!(await waitForSpawn(child))) {
      debugLog.emit('background_spawn_failed', {
        name: bg.name,
        pid: child.pid ?? null,
      });
      for (const other of backgrounds) {
        await killTreeAndWait(other, 1000, {
          log: debugLog,
          label: other === child ? bg.name : 'background',
          reason: 'background_spawn_failed',
        });
      }
      await logStore.close();
      debugLog.close();
      return { exitCode: 1, taskResults: [] };
    }
  }

  // Wait the global readiness gate (max of all background delays).
  const maxDelay = config.background.reduce(
    (max, bg) => Math.max(max, bg.delayMs),
    0,
  );
  if (maxDelay > 0) {
    await new Promise<void>((resolve) => {
      if (signal.aborted) {
        resolve();
        return;
      }
      const timer = setTimeout(resolve, maxDelay);
      signal.addEventListener(
        'abort',
        () => {
          clearTimeout(timer);
          resolve();
        },
        { once: true },
      );
    });
  }

  // Reject early if any background died during startup.
  const earlyExit = backgrounds.find(
    (b) =>
      b.spawnFailed ||
      !b.proc ||
      b.proc.exitCode !== null ||
      b.proc.signalCode !== null,
  );
  if (earlyExit) {
    debugLog.emit('background_early_exit', {
      name: earlyExit.proc ? config.background[backgrounds.indexOf(earlyExit)]?.name : null,
      pid: earlyExit.pid ?? null,
      spawnFailed: earlyExit.spawnFailed,
      procExitCode: earlyExit.proc?.exitCode ?? null,
      procSignalCode: earlyExit.proc?.signalCode ?? null,
    });
    for (const bg of backgrounds) {
      const bgConfig = config.background[backgrounds.indexOf(bg)]!;
      await killTreeAndWait(bg, 1000, {
        log: debugLog,
        label: bgConfig.name,
        reason: 'background_early_exit',
      });
    }
    await logStore.close();
    debugLog.close();
    return { exitCode: 1, taskResults: [] };
  }

  // Run tasks serially.
  const taskResults: TaskRecord[] = [];
  let stopRequested = false;

  for (const task of config.tasks) {
    if (stopRequested) break;

    const startTime = Date.now();
    debugLog.emit('task_start', {
      name: task.name,
      cwd: task.cwd ?? process.cwd(),
      command: task.command,
      timeoutMs: task.timeoutMs ?? null,
    });

    const child = spawnChild({
      command: task.command,
      args: [],
      cwd: task.cwd ?? process.cwd(),
      env: buildChildEnv(config.env, task.env),
      onStdout: (chunk) => logStore.appendChunk(task.name, 'stdout', chunk),
      onStderr: (chunk) => logStore.appendChunk(task.name, 'stderr', chunk),
    });

    debugLog.emit('task_spawn', {
      name: task.name,
      pid: child.pid ?? null,
      spawnFailed: child.spawnFailed,
    });

    let timedOut = false;
    let exitCode = 1;
    let closeCode: number | null = null;
    let closeSignal: NodeJS.Signals | null = null;

    if (task.timeoutMs !== undefined) {
      const timeoutHandle = setTimeout(() => {
        timedOut = true;
        debugLog.emit('task_timeout', {
          name: task.name,
          pid: child.pid ?? null,
          timeoutMs: task.timeoutMs,
        });
        void killTreeAndWait(child, 1000, {
          log: debugLog,
          label: task.name,
          reason: 'task_timeout',
        });
      }, task.timeoutMs);
      const result = await waitForChildExitOrAbort(child, signal);
      clearTimeout(timeoutHandle);
      if (result.aborted) {
        exitCode = 1;
      } else {
        closeCode = result.closeCode;
        closeSignal = result.signal;
        exitCode = result.exitCode;
      }
    } else {
      const result = await waitForChildExitOrAbort(child, signal);
      if (result.aborted) {
        exitCode = 1;
      } else {
        closeCode = result.closeCode;
        closeSignal = result.signal;
        exitCode = result.exitCode;
      }
    }

    const endTime = Date.now();
    const procExitCode = child.proc?.exitCode ?? null;
    const procSignalCode = child.proc?.signalCode ?? null;

    if (
      !child.spawnFailed &&
      child.proc &&
      child.proc.exitCode !== null
    ) {
      exitCode = child.proc.exitCode;
    } else if (child.proc?.signalCode !== null) {
      exitCode = 1;
    }

    debugLog.emit('task_end', {
      name: task.name,
      pid: child.pid ?? null,
      durationMs: endTime - startTime,
      timedOut,
      spawnFailed: child.spawnFailed,
      closeCode,
      closeSignal,
      procExitCode,
      procSignalCode,
      resolvedExitCode: exitCode,
    });

    taskResults.push({
      name: task.name,
      exitCode,
      startTime,
      endTime,
      timedOut,
    });

    if ((config.afterEach ?? []).length > 0) {
      await runAfterEachHooks(config.afterEach ?? [], {
        config,
        outputDir,
        taskName: task.name,
        taskExitCode: exitCode,
        debugLog,
        signal,
      });
    }

    if (exitCode !== 0 && config.stopOnFailure) {
      stopRequested = true;
    }

    if (signal.aborted) {
      stopRequested = true;
    }
  }

  // Always tear down backgrounds.
  const teardownGraceMs = signal.aborted ? 1000 : 5000;
  for (const bg of backgrounds) {
    const bgConfig = config.background[backgrounds.indexOf(bg)]!;
    await killTreeAndWait(bg, teardownGraceMs, {
      log: debugLog,
      label: bgConfig.name,
      reason: 'run_complete',
    });
  }
  await logStore.close();

  // Slice per-task logs.
  for (const record of taskResults) {
    const taskDir = path.join(outputDir, record.name);
    fs.mkdirSync(taskDir, { recursive: true });

    const taskTimeline = path.join(timelineDir, `${record.name}.jsonl`);
    if (fs.existsSync(taskTimeline)) {
      await sliceLogFile(
        taskTimeline,
        { startMs: record.startTime, endMs: record.endTime },
        path.join(taskDir, 'main.log'),
      );
    }

    for (const bg of config.background ?? []) {
      const bgTimeline = path.join(timelineDir, `${bg.name}.jsonl`);
      if (fs.existsSync(bgTimeline)) {
        await sliceLogFile(
          bgTimeline,
          { startMs: record.startTime, endMs: record.endTime },
          path.join(taskDir, `${bg.name}.log`),
        );
      }
    }
  }

  if (!config.keepRawTimeline) {
    fs.rmSync(timelineDir, { recursive: true, force: true });
  }

  const exitCode: 0 | 1 =
    taskResults.length > 0 && taskResults.every((r) => r.exitCode === 0)
      ? 0
      : 1;

  debugLog.emit('run_end', {
    exitCode,
    tasks: taskResults.map((task) => ({
      name: task.name,
      exitCode: task.exitCode,
      durationMs: task.endTime - task.startTime,
      timedOut: task.timedOut,
    })),
  });
  debugLog.close();

  return { exitCode, taskResults };
}

