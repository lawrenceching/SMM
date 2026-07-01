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