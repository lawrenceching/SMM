import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { runOrchestrator } from '../src/orchestrator.ts';
import type { Config } from '../src/config.ts';

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
  test('aborting while a long task is running returns within bounded time', async () => {
    const config: Config = {
      name: 'abort-during-task',
      outputDir: path.join(tmpRoot, 'out'),
      background: [
        { name: 'long-bg', command: sleepCommand(60), delayMs: 0 },
      ],
      tasks: [
        { name: 'long-task', command: sleepCommand(60) },
      ],
      afterEach: [],
      stopOnFailure: false,
      keepRawTimeline: false,
    };

    const controller = new AbortController();
    const runPromise = runOrchestrator(config, 'abort-1', { signal: controller.signal });

    await new Promise((resolve) => setTimeout(resolve, 500));
    controller.abort();

    const result = await runPromise;
    expect(typeof result.exitCode).toBe('number');
  });

  test('aborting before any task starts still resolves cleanly', async () => {
    const config: Config = {
      name: 'abort-before-task',
      outputDir: path.join(tmpRoot, 'out'),
      background: [
        { name: 'long-bg', command: sleepCommand(60), delayMs: 5000 },
      ],
      tasks: [
        { name: 'short-task', command: isWindows() ? 'cmd /c echo done' : 'sh -c "echo done"' },
      ],
      afterEach: [],
      stopOnFailure: false,
      keepRawTimeline: false,
    };

    const controller = new AbortController();
    setTimeout(() => controller.abort(), 200);

    const result = await runOrchestrator(config, 'abort-2', { signal: controller.signal });
    expect(typeof result.exitCode).toBe('number');
  });
});