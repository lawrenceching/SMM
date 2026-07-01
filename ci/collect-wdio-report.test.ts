import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const COLLECT_SCRIPT = path.join(ROOT, 'ci/collect-wdio-report.ts');

let tmpRoot: string;

beforeEach(() => {
  tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'collect-wdio-'));
});

afterEach(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

function runCollect(options: {
  cwd: string;
  taskName: string;
  outputDir: string;
}): { exitCode: number; stdout: string } {
  const proc = Bun.spawnSync(
    ['bun', COLLECT_SCRIPT],
    {
      cwd: options.cwd,
      env: {
        ...process.env,
        CICD_TASK_NAME: options.taskName,
        CICD_OUTPUT_DIR: options.outputDir,
      },
      stdout: 'pipe',
      stderr: 'pipe',
    },
  );

  return {
    exitCode: proc.exitCode,
    stdout: proc.stdout.toString(),
  };
}

describe('collect-wdio-report', () => {
  test('copies html-reports into task wdio-report dir', () => {
    const reportDir = path.join(tmpRoot, 'apps/e2e/reports/html-reports');
    fs.mkdirSync(reportDir, { recursive: true });
    fs.writeFileSync(path.join(reportDir, 'master-report.html'), '<html></html>');

    const outputDir = path.join(tmpRoot, 'artifacts/cicd/123');
    const result = runCollect({
      cwd: tmpRoot,
      taskName: 'SearchMovie.e2e.ts',
      outputDir,
    });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('copied');

    const dest = path.join(outputDir, 'SearchMovie.e2e.ts/wdio-report/master-report.html');
    expect(fs.existsSync(dest)).toBe(true);
  });

  test('skips when report dir is missing', () => {
    const outputDir = path.join(tmpRoot, 'artifacts/cicd/123');
    const result = runCollect({
      cwd: tmpRoot,
      taskName: 'wait-ready',
      outputDir,
    });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('skip');
    expect(fs.existsSync(path.join(outputDir, 'wait-ready'))).toBe(false);
  });

  test('skips when CICD env is missing', () => {
    const proc = Bun.spawnSync(['bun', COLLECT_SCRIPT], {
      cwd: tmpRoot,
      stdout: 'pipe',
      stderr: 'pipe',
    });

    expect(proc.exitCode).toBe(0);
    expect(proc.stdout.toString()).toContain('skip');
  });
});
