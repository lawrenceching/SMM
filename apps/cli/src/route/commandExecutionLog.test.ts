import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, readFileSync, rmSync, existsSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';
import { createCommandExecutionLogWriter } from './commandExecutionLog';

describe('createCommandExecutionLogWriter', () => {
  let prevLogDir: string | undefined;
  let tmpLogRoot: string;

  beforeEach(() => {
    prevLogDir = process.env.LOG_DIR;
    tmpLogRoot = mkdtempSync(path.join(tmpdir(), 'smm-cmdlog-'));
    process.env.LOG_DIR = tmpLogRoot;
  });

  afterEach(() => {
    if (prevLogDir === undefined) {
      delete process.env.LOG_DIR;
    } else {
      process.env.LOG_DIR = prevLogDir;
    }
    if (existsSync(tmpLogRoot)) {
      rmSync(tmpLogRoot, { recursive: true, force: true });
    }
  });

  it('creates commands/<id>/main.log and records stdout/stderr with markers', async () => {
    const fixedId = '00000000-0000-4000-8000-000000000001';
    const writer = await createCommandExecutionLogWriter(fixedId);

    expect(writer.executionId).toBe(fixedId);
    expect(writer.logRelativePath).toBe(path.posix.join('commands', fixedId, 'main.log'));

    const expectedDir = path.join(tmpLogRoot, 'commands', fixedId);
    expect(writer.logDir).toBe(expectedDir);
    expect(writer.logFilePath).toBe(path.join(expectedDir, 'main.log'));

    writer.appendStdout('hello-out\n');
    writer.appendStderr('hello-err');
    writer.appendSystemNote('done');
    writer.close();

    const content = readFileSync(writer.logFilePath, 'utf8');
    expect(content).toContain('--- stream=stdout ');
    expect(content).toContain('hello-out\n');
    expect(content).toContain('--- stream=stderr ');
    expect(content).toContain('hello-err');
    expect(content).toContain('--- system ');
    expect(content).toContain('done');
  });
});
