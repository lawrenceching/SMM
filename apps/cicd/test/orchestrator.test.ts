import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { run } from '../src/index.ts';

let tmpRoot: string;

beforeEach(() => {
  tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'cicd-int-'));
});

afterEach(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

function writeConfig(config: object): string {
  const dir = path.join(tmpRoot, 'cfg');
  fs.mkdirSync(dir, { recursive: true });
  const filePath = path.join(dir, 'config.json');
  fs.writeFileSync(filePath, JSON.stringify(config));
  return filePath;
}

function isWindows() {
  return process.platform === 'win32';
}

describe('run — happy path', () => {
  test('one background, one task: exit 0, expected output files', async () => {
    const configPath = writeConfig({
      name: 'happy',
      outputDir: path.join(tmpRoot, 'out'),
      background: [
        {
          name: 'ticker',
          command: isWindows()
            ? 'cmd /c "for /L %i in (1,1,30) do echo tick&ping -n 1 127.0.0.1 > nul"'
            : 'sh -c "for i in 1 2 3; do echo tick; sleep 0.05; done"',
          delayMs: 200,
        },
      ],
      tasks: [
        {
          name: 'task1',
          command: isWindows() ? 'cmd /c echo hello-from-task' : 'sh -c "echo hello-from-task"',
        },
      ],
    });

    const result = await run({ configPath, cwd: tmpRoot });

    expect(result.exitCode).toBe(0);
    expect(result.taskResults).toHaveLength(1);
    expect(result.taskResults[0]!.name).toBe('task1');
    expect(result.taskResults[0]!.exitCode).toBe(0);

    const taskDir = path.join(result.outputDir, 'task1');
    const mainLog = fs.readFileSync(path.join(taskDir, 'main.log'), 'utf8');
    expect(mainLog.trim()).toBe('hello-from-task');

    const tickerLog = fs.readFileSync(path.join(taskDir, 'ticker.log'), 'utf8');
    // At least one tick should be captured during the task window.
    expect(tickerLog.trim().length).toBeGreaterThan(0);
  });

  test('multiple tasks share one background, each gets its own slice', async () => {
    const configPath = writeConfig({
      name: 'multi',
      outputDir: path.join(tmpRoot, 'out'),
      background: [
        {
          name: 'counter',
          command: isWindows()
            ? 'cmd /c "for /L %i in (1,1,30) do echo line-%i&ping -n 1 127.0.0.1 > nul"'
            : 'sh -c "for i in 1 2 3 4 5; do echo line-$i; sleep 0.05; done"',
          delayMs: 200,
        },
      ],
      tasks: [
        { name: 'first', command: isWindows() ? 'cmd /c echo first-task' : 'sh -c "echo first-task"' },
        { name: 'second', command: isWindows() ? 'cmd /c echo second-task' : 'sh -c "echo second-task"' },
      ],
    });

    const result = await run({ configPath, cwd: tmpRoot });
    expect(result.exitCode).toBe(0);
    expect(result.taskResults.map((r) => r.name)).toEqual(['first', 'second']);
  });
});

describe('run — failure handling', () => {
  test('stopOnFailure=true: failure halts further tasks, exits 1', async () => {
    const configPath = writeConfig({
      name: 'stop',
      outputDir: path.join(tmpRoot, 'out'),
      stopOnFailure: true,
      tasks: [
        { name: 'fails', command: isWindows() ? 'cmd /c exit 1' : 'sh -c "exit 1"' },
        { name: 'never-runs', command: isWindows() ? 'cmd /c echo should-not-appear' : 'sh -c "echo should-not-appear"' },
      ],
    });

    const result = await run({ configPath, cwd: tmpRoot });
    expect(result.exitCode).toBe(1);
    expect(result.taskResults.map((r) => r.name)).toEqual(['fails']);
  });

  test('stopOnFailure=false: all tasks run, exit code is 1 if any failed', async () => {
    const configPath = writeConfig({
      name: 'continue',
      outputDir: path.join(tmpRoot, 'out'),
      stopOnFailure: false,
      tasks: [
        { name: 'fails', command: isWindows() ? 'cmd /c exit 1' : 'sh -c "exit 1"' },
        { name: 'passes', command: isWindows() ? 'cmd /c echo passes' : 'sh -c "echo passes"' },
      ],
    });

    const result = await run({ configPath, cwd: tmpRoot });
    expect(result.exitCode).toBe(1);
    expect(result.taskResults.map((r) => r.name)).toEqual(['fails', 'passes']);

    const passesDir = path.join(result.outputDir, 'passes');
    expect(fs.readFileSync(path.join(passesDir, 'main.log'), 'utf8').trim()).toBe('passes');
  });

  test('task timeout kills the task and marks it timed out', async () => {
    const configPath = writeConfig({
      name: 'timeout',
      outputDir: path.join(tmpRoot, 'out'),
      tasks: [
        {
          name: 'slow',
          command: isWindows() ? 'cmd /c ping -n 30 127.0.0.1 > nul' : 'sh -c "sleep 30"',
          timeoutMs: 300,
        },
      ],
    });

    const before = Date.now();
    const result = await run({ configPath, cwd: tmpRoot });
    const elapsed = Date.now() - before;

    expect(result.exitCode).toBe(1);
    expect(result.taskResults[0]!.timedOut).toBe(true);
    expect(elapsed).toBeLessThan(10000); // Well under the 30s sleep.
  });
});

describe('run — output layout', () => {
  test('keepRawTimeline=false removes _timeline after slicing', async () => {
    const configPath = writeConfig({
      name: 'no-raw',
      outputDir: path.join(tmpRoot, 'out'),
      keepRawTimeline: false,
      tasks: [
        { name: 't', command: isWindows() ? 'cmd /c echo done' : 'sh -c "echo done"' },
      ],
    });

    const result = await run({ configPath, cwd: tmpRoot });
    expect(result.exitCode).toBe(0);
    expect(fs.existsSync(path.join(result.outputDir, '_timeline'))).toBe(false);
  });

  test('keepRawTimeline=true preserves _timeline', async () => {
    const configPath = writeConfig({
      name: 'keep-raw',
      outputDir: path.join(tmpRoot, 'out'),
      keepRawTimeline: true,
      tasks: [
        { name: 't', command: isWindows() ? 'cmd /c echo done' : 'sh -c "echo done"' },
      ],
    });

    const result = await run({ configPath, cwd: tmpRoot });
    expect(result.exitCode).toBe(0);
    expect(fs.existsSync(path.join(result.outputDir, '_timeline', 't.jsonl'))).toBe(true);
  });
});

describe('run — env', () => {
  test('config-level env is visible to tasks', async () => {
    const configPath = writeConfig({
      name: 'config-env',
      outputDir: path.join(tmpRoot, 'out'),
      env: { CICD_TEST_VAR: 'from-config' },
      tasks: [
        {
          name: 't',
          command: isWindows()
            ? 'cmd /c echo %CICD_TEST_VAR%'
            : 'node -e "console.log(process.env.CICD_TEST_VAR)"',
        },
      ],
    });

    const result = await run({ configPath, cwd: tmpRoot });
    expect(result.exitCode).toBe(0);

    const mainLog = fs.readFileSync(
      path.join(result.outputDir, 't', 'main.log'),
      'utf8',
    );
    expect(mainLog.trim()).toBe('from-config');
  });

  test('task-level env overrides config-level env', async () => {
    const configPath = writeConfig({
      name: 'env-override',
      outputDir: path.join(tmpRoot, 'out'),
      env: { CICD_TEST_VAR: 'from-config' },
      tasks: [
        {
          name: 't',
          env: { CICD_TEST_VAR: 'from-task' },
          command: isWindows()
            ? 'cmd /c echo %CICD_TEST_VAR%'
            : 'node -e "console.log(process.env.CICD_TEST_VAR)"',
        },
      ],
    });

    const result = await run({ configPath, cwd: tmpRoot });
    expect(result.exitCode).toBe(0);

    const mainLog = fs.readFileSync(
      path.join(result.outputDir, 't', 'main.log'),
      'utf8',
    );
    expect(mainLog.trim()).toBe('from-task');
  });
});

describe('run — afterEach', () => {
  test('afterEach runs after each task with CICD context env', async () => {
    const hookCommand = isWindows()
      ? 'cmd /c "mkdir %CICD_OUTPUT_DIR%\\%CICD_TASK_NAME% 2>nul & echo %CICD_TASK_NAME%>%CICD_OUTPUT_DIR%\\%CICD_TASK_NAME%\\hook-ran.txt"'
      : 'node -e "const fs=require(\'fs\');const p=process.env.CICD_OUTPUT_DIR+\'/\'+process.env.CICD_TASK_NAME;fs.mkdirSync(p,{recursive:true});fs.writeFileSync(p+\'/hook-ran.txt\',process.env.CICD_TASK_NAME)"';

    const configPath = writeConfig({
      name: 'hooks',
      outputDir: path.join(tmpRoot, 'out'),
      afterEach: [{ name: 'record', command: hookCommand }],
      tasks: [
        { name: 'first', command: isWindows() ? 'cmd /c echo first-task' : 'sh -c "echo first-task"' },
        { name: 'second', command: isWindows() ? 'cmd /c echo second-task' : 'sh -c "echo second-task"' },
      ],
    });

    const result = await run({ configPath, cwd: tmpRoot });
    expect(result.exitCode).toBe(0);

    expect(
      fs.readFileSync(path.join(result.outputDir, 'first/hook-ran.txt'), 'utf8').trim(),
    ).toBe('first');
    expect(
      fs.readFileSync(path.join(result.outputDir, 'second/hook-ran.txt'), 'utf8').trim(),
    ).toBe('second');
  });

  test('afterEach runs after failed task even when stopOnFailure stops later tasks', async () => {
    const hookCommand = isWindows()
      ? 'cmd /c "mkdir %CICD_OUTPUT_DIR%\\%CICD_TASK_NAME% 2>nul & echo ran>%CICD_OUTPUT_DIR%\\%CICD_TASK_NAME%\\hook-ran.txt"'
      : 'node -e "const fs=require(\'fs\');const p=process.env.CICD_OUTPUT_DIR+\'/\'+process.env.CICD_TASK_NAME;fs.mkdirSync(p,{recursive:true});fs.writeFileSync(p+\'/hook-ran.txt\',\'ran\')"';

    const configPath = writeConfig({
      name: 'hooks-on-fail',
      outputDir: path.join(tmpRoot, 'out'),
      stopOnFailure: true,
      afterEach: [{ name: 'record', command: hookCommand }],
      tasks: [
        { name: 'fails', command: isWindows() ? 'cmd /c exit 1' : 'sh -c "exit 1"' },
        { name: 'never-runs', command: isWindows() ? 'cmd /c echo x' : 'sh -c "echo x"' },
      ],
    });

    const result = await run({ configPath, cwd: tmpRoot });
    expect(result.exitCode).toBe(1);
    expect(result.taskResults.map((r) => r.name)).toEqual(['fails']);
    expect(
      fs.existsSync(path.join(result.outputDir, 'fails/hook-ran.txt')),
    ).toBe(true);
    expect(
      fs.existsSync(path.join(result.outputDir, 'never-runs/hook-ran.txt')),
    ).toBe(false);
  });
});

describe('run — config errors', () => {
  test('invalid config throws with structured errors', async () => {
    const configPath = writeConfig({
      name: 'bad',
      tasks: [{ name: 't', command: 'x', timeoutMs: -5 }],
    });

    await expect(run({ configPath, cwd: tmpRoot })).rejects.toThrow(/Invalid config/);
  });
});

describe('run — spawn failures', () => {
  test('invalid task command fails fast without hanging', async () => {
    const configPath = writeConfig({
      name: 'bad-spawn',
      outputDir: path.join(tmpRoot, 'out'),
      tasks: [
        {
          name: 'bad',
          command: 'definitely-not-a-real-command-xyz123',
        },
      ],
    });

    const start = Date.now();
    const result = await run({ configPath, cwd: tmpRoot });
    expect(result.exitCode).toBe(1);
    expect(result.taskResults).toHaveLength(1);
    expect(result.taskResults[0]!.exitCode).toBe(1);
    expect(Date.now() - start).toBeLessThan(5000);
  });
});
