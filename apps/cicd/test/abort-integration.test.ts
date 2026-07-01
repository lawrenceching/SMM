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
