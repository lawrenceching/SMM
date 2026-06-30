import * as fs from 'node:fs';
import * as path from 'node:path';
import type { Config } from './config.ts';
import type { TaskRecord } from './types.ts';
import { DebugLog } from './debug-log.ts';
import { LogStore } from './log-store.ts';
import { sliceLogFile } from './slicer.ts';
import {
  spawnChild,
  killTreeAndWait,
  waitForChildExit,
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

export async function runOrchestrator(
  config: Config,
  commandId: string,
): Promise<OrchestratorResult> {
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
    await new Promise((resolve) => setTimeout(resolve, maxDelay));
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
      const exitResult = await waitForChildExit(child);
      clearTimeout(timeoutHandle);
      closeCode = exitResult.closeCode;
      closeSignal = exitResult.signal;
      exitCode = exitResult.exitCode;
    } else {
      const exitResult = await waitForChildExit(child);
      closeCode = exitResult.closeCode;
      closeSignal = exitResult.signal;
      exitCode = exitResult.exitCode;
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

    if (exitCode !== 0 && config.stopOnFailure) {
      stopRequested = true;
    }
  }

  // Always tear down backgrounds.
  for (const bg of backgrounds) {
    const bgConfig = config.background[backgrounds.indexOf(bg)]!;
    await killTreeAndWait(bg, 5000, {
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

    await sliceLogFile(
      path.join(timelineDir, `${record.name}.jsonl`),
      { startMs: record.startTime, endMs: record.endTime },
      path.join(taskDir, 'main.log'),
    );

    for (const bg of config.background) {
      await sliceLogFile(
        path.join(timelineDir, `${bg.name}.jsonl`),
        { startMs: record.startTime, endMs: record.endTime },
        path.join(taskDir, `${bg.name}.log`),
      );
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

