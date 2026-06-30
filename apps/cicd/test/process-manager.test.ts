import { describe, test, expect } from 'bun:test';
import { spawnChild, killTreeAndWait, waitForChildExit } from '../src/process-manager.ts';

describe('spawnChild', () => {
  test('captures stdout from a simple command', async () => {
    const chunks: Buffer[] = [];
    const child = spawnChild({
      command: process.platform === 'win32' ? 'cmd' : 'sh',
      args: process.platform === 'win32' ? ['/c', 'echo hello'] : ['-c', 'echo hello'],
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
      command: process.platform === 'win32' ? 'cmd' : 'sh',
      args:
        process.platform === 'win32'
          ? ['/c', 'echo oops 1>&2']
          : ['-c', 'echo oops 1>&2'],
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
      command: process.platform === 'win32' ? 'cmd' : 'sh',
      args:
        process.platform === 'win32'
          ? ['/c', 'exit 7']
          : ['-c', 'exit 7'],
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
    const exitCode = await waitForChildExit(child);
    expect(exitCode).toBe(1);
    expect(Date.now() - start).toBeLessThan(2000);
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
