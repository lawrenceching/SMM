import { describe, test, expect } from 'bun:test';
import {
  spawnChild,
  killTreeAndWait,
  waitForChildExit,
  waitForChildExitOrAbort,
} from '../src/process-manager.ts';

describe('spawnChild', () => {
  test('captures stdout from a simple command', async () => {
    const chunks: Buffer[] = [];
    const child = spawnChild({
      command: 'echo hello',
      args: [],
      cwd: process.cwd(),
      env: process.env,
      onStdout: (chunk) => chunks.push(chunk),
      onStderr: () => {},
    });

    await new Promise<void>((resolve) => {
      child.proc!.on('close', () => resolve());
    });

    const output = Buffer.concat(chunks).toString('utf8').trim();
    expect(output).toBe('hello');
  });

  test('captures stderr from a command that writes to stderr', async () => {
    const stderrChunks: Buffer[] = [];
    const child = spawnChild({
      command: process.platform === 'win32' ? 'cmd /c "echo oops 1>&2"' : 'echo oops 1>&2',
      args: [],
      cwd: process.cwd(),
      env: process.env,
      onStdout: () => {},
      onStderr: (chunk) => stderrChunks.push(chunk),
    });

    await new Promise<void>((resolve) => {
      child.proc!.on('close', () => resolve());
    });

    const output = Buffer.concat(stderrChunks).toString('utf8').trim();
    expect(output).toBe('oops');
  });

  test('captures non-zero exit code', async () => {
    const child = spawnChild({
      command: process.platform === 'win32' ? 'cmd /c "exit /b 7"' : 'exit 7',
      args: [],
      cwd: process.cwd(),
      env: process.env,
      onStdout: () => {},
      onStderr: () => {},
    });

    const exitCode = await new Promise<number | null>((resolve) => {
      child.proc!.on('close', (code) => resolve(code));
    });

    expect(exitCode).toBe(7);
  });

  test('invalid command resolves exit without hanging', async () => {
    const child = spawnChild({
      command: 'definitely-not-a-real-command-xyz123',
      args: [],
      cwd: process.cwd(),
      env: process.env,
      onStdout: () => {},
      onStderr: () => {},
    });

    const start = Date.now();
    const result = await waitForChildExit(child);
    expect(result.exitCode).not.toBe(0); // shell returns 1 (Win cmd) or 127 (Unix sh)
    expect(Date.now() - start).toBeLessThan(2000);
  });

  test('waitForChildExit reports close code and signal', async () => {
    const child = spawnChild({
      command: process.platform === 'win32' ? 'cmd /c "exit /b 3"' : 'exit 3',
      args: [],
      cwd: process.cwd(),
      env: process.env,
      onStdout: () => {},
      onStderr: () => {},
    });

    const result = await waitForChildExit(child);
    expect(result.closeCode).toBe(3);
    expect(result.exitCode).toBe(3);
  });
});

describe('killTreeAndWait', () => {
  test('terminates a running child', async () => {
    const isWindows = process.platform === 'win32';
    const child = spawnChild({
      command: isWindows ? 'cmd' : 'sh',
      args: isWindows
        ? ['/c', 'ping -n 60 127.0.0.1 > nul']
        : ['-c', 'sleep 60'],
      cwd: process.cwd(),
      env: process.env,
      onStdout: () => {},
      onStderr: () => {},
    });

    // Give the child a moment to actually start.
    await new Promise((resolve) => setTimeout(resolve, 200));

    const beforeKill = Date.now();
    await killTreeAndWait(child, 2000);
    const elapsed = Date.now() - beforeKill;

    expect(
      child.proc!.killed ||
        child.proc!.exitCode !== null ||
        child.proc!.signalCode !== null,
    ).toBe(true);
    // Should complete well before the sleep ends.
    expect(elapsed).toBeLessThan(10000);
  });
});

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
    expect(result.aborted).toBe(false);
    if (!result.aborted) {
      expect(result.exitCode).toBe(0);
    }
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

    await new Promise((resolve) => setTimeout(resolve, 200));

    const controller = new AbortController();
    const before = Date.now();
    const promise = waitForChildExitOrAbort(child, controller.signal);

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
