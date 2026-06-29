import * as fs from 'node:fs';
import * as path from 'node:path';
import type { Config } from './config.ts';
import type { TaskRecord } from './types.ts';
import { LogStore } from './log-store.ts';
import { sliceLogFile } from './slicer.ts';
import {
  spawnChild,
  killTreeAndWait,
  type ManagedChild,
} from './process-manager.ts';

export interface OrchestratorResult {
  exitCode: 0 | 1;
  taskResults: TaskRecord[];
}

export async function runOrchestrator(
  config: Config,
  commandId: string,
): Promise<OrchestratorResult> {
  const outputDir = path.resolve(config.outputDir, String(commandId));
  const timelineDir = path.join(outputDir, '_timeline');
  fs.mkdirSync(timelineDir, { recursive: true });

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
    try {
      const child = spawnChild({
        command: bg.command,
        args: [],
        cwd: bg.cwd ?? process.cwd(),
        env: { ...process.env, ...(bg.env ?? {}) },
        onStdout: (chunk) => logStore.appendChunk(bg.name, 'stdout', chunk),
        onStderr: (chunk) => logStore.appendChunk(bg.name, 'stderr', chunk),
      });
      backgrounds.push(child);
    } catch {
      for (const other of backgrounds) {
        await killTreeAndWait(other, 1000);
      }
      await logStore.close();
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
    (b) => b.proc.exitCode !== null || b.proc.signalCode !== null,
  );
  if (earlyExit) {
    for (const bg of backgrounds) {
      await killTreeAndWait(bg, 1000);
    }
    await logStore.close();
    return { exitCode: 1, taskResults: [] };
  }

  // Run tasks serially.
  const taskResults: TaskRecord[] = [];
  let stopRequested = false;

  for (const task of config.tasks) {
    if (stopRequested) break;

    const startTime = Date.now();
    const child = spawnChild({
      command: task.command,
      args: [],
      cwd: task.cwd ?? process.cwd(),
      env: { ...process.env, ...(task.env ?? {}) },
      onStdout: (chunk) => logStore.appendChunk(task.name, 'stdout', chunk),
      onStderr: (chunk) => logStore.appendChunk(task.name, 'stderr', chunk),
    });

    let timedOut = false;
    const exitPromise = new Promise<void>((resolve) => {
      child.proc.once('close', () => resolve());
    });

    if (task.timeoutMs !== undefined) {
      const timeoutHandle = setTimeout(() => {
        timedOut = true;
        void killTreeAndWait(child, 1000);
      }, task.timeoutMs);
      await exitPromise;
      clearTimeout(timeoutHandle);
    } else {
      await exitPromise;
    }

    const endTime = Date.now();
    const exitCode =
      child.proc.exitCode ?? (child.proc.signalCode !== null ? 1 : 0);

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
    await killTreeAndWait(bg, 5000);
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
  return { exitCode, taskResults };
}

