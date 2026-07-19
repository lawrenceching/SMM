import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const COLLECT_SCRIPT = path.join(ROOT, 'ci/collect-ohos-logs.ts');

let tmpRoot: string;

beforeEach(() => {
  tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'collect-ohos-'));
});

afterEach(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

function runCollect(options: {
  cwd: string;
  taskName: string;
  outputDir: string;
}): { exitCode: number; stdout: string } {
  const proc = Bun.spawnSync(['bun', COLLECT_SCRIPT], {
    cwd: options.cwd,
    env: {
      ...process.env,
      CICD_TASK_NAME: options.taskName,
      CICD_OUTPUT_DIR: options.outputDir,
    },
    stdout: 'pipe',
    stderr: 'pipe',
  });

  return {
    exitCode: proc.exitCode,
    stdout: proc.stdout.toString(),
  };
}

describe('collect-ohos-logs', () => {
  test('copies hilog / electron / frontend-console into task ohos-log dir', () => {
    const hilogDir = path.join(tmpRoot, 'apps/e2e/reports/ohos-hilog');
    fs.mkdirSync(hilogDir, { recursive: true });
    fs.writeFileSync(path.join(hilogDir, 'hilog.log'), 'raw hilog\n');
    fs.writeFileSync(path.join(hilogDir, 'electron.log'), 'electron line\n');
    fs.writeFileSync(path.join(hilogDir, 'frontend-console.log'), 'console line\n');

    const outputDir = path.join(tmpRoot, 'artifacts/cicd/123');
    const result = runCollect({
      cwd: tmpRoot,
      taskName: 'TVShow-Import.e2e.ts',
      outputDir,
    });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('copied');

    const destDir = path.join(outputDir, 'TVShow-Import.e2e.ts/ohos-log');
    expect(fs.readFileSync(path.join(destDir, 'hilog.log'), 'utf8')).toBe('raw hilog\n');
    expect(fs.readFileSync(path.join(destDir, 'electron.log'), 'utf8')).toBe('electron line\n');
    expect(fs.readFileSync(path.join(destDir, 'frontend-console.log'), 'utf8')).toBe(
      'console line\n',
    );
  });

  test('skips when ohos-hilog files are missing', () => {
    const outputDir = path.join(tmpRoot, 'artifacts/cicd/123');
    const result = runCollect({
      cwd: tmpRoot,
      taskName: 'TVShow-Import.e2e.ts',
      outputDir,
    });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('skip');
    expect(fs.existsSync(path.join(outputDir, 'TVShow-Import.e2e.ts'))).toBe(false);
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
