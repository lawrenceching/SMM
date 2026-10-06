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

  it('creates commands/<id>/main.log and prefixes each line with ISO timestamp + [KIND]', async () => {
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
    expect(content).toMatch(/^\d{4}-\d{2}-\d{2}T[\d:.]+Z \[STDOUT\] hello-out/m);
    expect(content).toMatch(/^\d{4}-\d{2}-\d{2}T[\d:.]+Z \[STDERR\] hello-err/m);
    expect(content).toMatch(/^\d{4}-\d{2}-\d{2}T[\d:.]+Z \[SYSTEM\] done/m);
  });
});
