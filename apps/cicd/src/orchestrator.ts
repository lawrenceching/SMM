import * as fs from 'node:fs';
import * as path from 'node:path';
import type { Config, Hook } from './config.ts';
import type { HookRecord, TaskRecord } from './types.ts';
import { DebugLog } from './debug-log.ts';
import { LogStore } from './log-store.ts';
import { sliceLogFile } from './slicer.ts';
import { redactTextFilesInDir } from '../../../ci/scan-secure-data-lib';
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
  onArtifactsReadyResults: HookRecord[];
}

function buildChildEnv(
  configEnv: Record<string, string> | undefined,
  itemEnv: Record<string, string> | undefined,
): NodeJS.ProcessEnv {
  return { ...process.env, ...configEnv, ...itemEnv };
}

/** Resolve task/background/hook cwd: omit → projectRoot; relative → under projectRoot; absolute → as-is. */
export function resolveItemCwd(
  itemCwd: string | undefined,
  projectRoot: string,
): string {
  if (!itemCwd) return projectRoot;
  return path.isAbsolute(itemCwd) ? itemCwd : path.resolve(projectRoot, itemCwd);
}

type HookPhase = 'after_each' | 'artifacts_ready';

type HookRunOutcome = {
  exitCode: number;
  startTime: number;
  endTime: number;
  timedOut: boolean;
};

async function runHook(
  hook: Hook,
  options: {
    config: Config;
    projectRoot: string;
    hookEnv: Record<string, string>;
    debugLog: DebugLog;
    signal: AbortSignal;
    phase: HookPhase;
    debugContext?: Record<string, unknown>;
  },
): Promise<HookRunOutcome> {
  const { config, projectRoot, hookEnv, debugLog, signal, phase, debugContext } = options;
  const startTime = Date.now();
  const cwd = resolveItemCwd(hook.cwd, projectRoot);

  debugLog.emit(`${phase}_start`, {
    hookName: hook.name,
    command: hook.command,
    cwd,
    ...debugContext,
  });

  const child = spawnChild({
    command: hook.command,
    args: [],
    cwd,
    env: buildChildEnv(config.env, {
      ...hook.env,
      ...hookEnv,
    }),
    onStdout: (chunk) => process.stdout.write(chunk),
    onStderr: (chunk) => process.stderr.write(chunk),
  });

  let exitCode = 1;
  let timedOut = false;

  if (hook.timeoutMs !== undefined) {
    const timeoutHandle = setTimeout(() => {
      timedOut = true;
      debugLog.emit(`${phase}_timeout`, {
        hookName: hook.name,
        timeoutMs: hook.timeoutMs,
        ...debugContext,
      });
      void killTreeAndWait(child, 1000, {
        log: debugLog,
        label: hook.name,
        reason: `${phase}_timeout`,
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

  const endTime = Date.now();

  debugLog.emit(`${phase}_end`, {
    hookName: hook.name,
    exitCode,
    spawnFailed: child.spawnFailed,
    timedOut,
    ...debugContext,
  });

  return { exitCode, startTime, endTime, timedOut };
}

async function runAfterEachHooks(
  hooks: Hook[],
  options: {
    config: Config;
    projectRoot: string;
    outputDir: string;
    taskName: string;
    taskExitCode: number;
    debugLog: DebugLog;
    signal: AbortSignal;
  },
): Promise<void> {
  const { config, projectRoot, outputDir, taskName, taskExitCode, debugLog, signal } = options;
  for (const hook of hooks) {
    await runHook(hook, {
      config,
      projectRoot,
      hookEnv: {
        CICD_TASK_NAME: taskName,
        CICD_OUTPUT_DIR: outputDir,
        CICD_TASK_EXIT_CODE: String(taskExitCode),
      },
      debugLog,
      signal,
      phase: 'after_each',
      debugContext: { taskName, taskExitCode },
    });
    if (signal.aborted) return;
  }
}

/** Returns hook records; all passed when every hook exited 0. */
async function runOnArtifactsReadyHooks(
  hooks: Hook[],
  options: {
    config: Config;
    projectRoot: string;
    outputDir: string;
    taskExitCode: number;
    taskNames: string[];
    debugLog: DebugLog;
    signal: AbortSignal;
  },
): Promise<HookRecord[]> {
  const { config, projectRoot, outputDir, taskExitCode, taskNames, debugLog, signal } = options;
  const results: HookRecord[] = [];
  for (const hook of hooks) {
    if (hook.when === 'success' && taskExitCode !== 0) {
      const now = Date.now();
      debugLog.emit('artifacts_ready_skip', {
        hookName: hook.name,
        when: hook.when,
        taskExitCode,
        reason: 'tasks_not_successful',
      });
      results.push({
        name: hook.name,
        exitCode: 0,
        startTime: now,
        endTime: now,
        timedOut: false,
        skipped: true,
      });
      continue;
    }

    const outcome = await runHook(hook, {
      config,
      projectRoot,
      hookEnv: {
        CICD_OUTPUT_DIR: outputDir,
        CICD_ARTIFACT_DIR: outputDir,
        CICD_EXIT_CODE: String(taskExitCode),
        CICD_TASK_NAMES: taskNames.join(','),
      },
      debugLog,
      signal,
      phase: 'artifacts_ready',
      debugContext: {
        taskExitCode,
        taskNames,
      },
    });
    results.push({
      name: hook.name,
      exitCode: outcome.exitCode,
      startTime: outcome.startTime,
      endTime: outcome.endTime,
      timedOut: outcome.timedOut,
      skipped: false,
    });
    if (signal.aborted) return results;
  }
  return results;
}

export async function runOrchestrator(
  config: Config,
  commandId: string,
  options: { signal?: AbortSignal; projectRoot?: string } = {},
): Promise<OrchestratorResult> {
  const signal = options.signal ?? new AbortController().signal;
  const projectRoot = options.projectRoot ?? process.cwd();
  const outputDir = path.resolve(projectRoot, config.outputDir, String(commandId));
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
    const cwd = resolveItemCwd(bg.cwd, projectRoot);
    const child = spawnChild({
      command: bg.command,
      args: [],
      cwd,
      env: buildChildEnv(config.env, bg.env),
      onStdout: (chunk) => logStore.appendChunk(bg.name, 'stdout', chunk),
      onStderr: (chunk) => logStore.appendChunk(bg.name, 'stderr', chunk),
    });
    backgrounds.push(child);

    debugLog.emit('background_spawn', {
      name: bg.name,
      pid: child.pid ?? null,
      spawnFailed: child.spawnFailed,
      cwd,
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
      return { exitCode: 1, taskResults: [], onArtifactsReadyResults: [] };
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
    return { exitCode: 1, taskResults: [], onArtifactsReadyResults: [] };
  }

  // Run tasks serially.
  const taskResults: TaskRecord[] = [];
  let stopRequested = false;

  for (const task of config.tasks) {
    if (stopRequested) break;

    const startTime = Date.now();
    const cwd = resolveItemCwd(task.cwd, projectRoot);
    const timeoutMs = task.timeoutMs ?? config.taskTimeout;
    debugLog.emit('task_start', {
      name: task.name,
      cwd,
      command: task.command,
      timeoutMs: timeoutMs ?? null,
    });

    const child = spawnChild({
      command: task.command,
      args: [],
      cwd,
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

    if (timeoutMs !== undefined) {
      const timeoutHandle = setTimeout(() => {
        timedOut = true;
        debugLog.emit('task_timeout', {
          name: task.name,
          pid: child.pid ?? null,
          timeoutMs,
        });
        void killTreeAndWait(child, 1000, {
          log: debugLog,
          label: task.name,
          reason: 'task_timeout',
        });
      }, timeoutMs);
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
        projectRoot,
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

  const tasksExitCode: 0 | 1 =
    taskResults.length > 0 && taskResults.every((r) => r.exitCode === 0)
      ? 0
      : 1;

  let onArtifactsReadyResults: HookRecord[] = [];
  if (taskResults.length > 0 && (config.onArtifactsReady ?? []).length > 0) {
    onArtifactsReadyResults = await runOnArtifactsReadyHooks(config.onArtifactsReady ?? [], {
      config,
      projectRoot,
      outputDir,
      taskExitCode: tasksExitCode,
      taskNames: taskResults.map((r) => r.name),
      debugLog,
      signal,
    });
  }

  const artifactsReadyOk =
    onArtifactsReadyResults.length === 0 ||
    onArtifactsReadyResults.every(
      (r) => r.skipped || (r.exitCode === 0 && !r.timedOut),
    );

  redactTextFilesInDir(outputDir);

  if (!config.keepRawTimeline) {
    fs.rmSync(timelineDir, { recursive: true, force: true });
  }

  const exitCode: 0 | 1 =
    taskResults.length > 0 && tasksExitCode === 0 && artifactsReadyOk ? 0 : 1;

  debugLog.emit('run_end', {
    exitCode,
    tasks: taskResults.map((task) => ({
      name: task.name,
      exitCode: task.exitCode,
      durationMs: task.endTime - task.startTime,
      timedOut: task.timedOut,
    })),
    artifactsReadyOk,
  });
  debugLog.close();

  return { exitCode, taskResults, onArtifactsReadyResults };
}

