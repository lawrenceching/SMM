import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { sliceLogFile, type TimeRange } from '../src/slicer.ts';

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'slicer-'));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

function writeJsonl(name: string, entries: Array<{ ts: number; msg: string }>): string {
  const filePath = path.join(tmpDir, name);
  const content = entries
    .map((e) => JSON.stringify({ timestamp: e.ts, stream: 'stdout', message: e.msg }))
    .join('\n');
  fs.writeFileSync(filePath, content + '\n');
  return filePath;
}

describe('sliceLogFile', () => {
  test('filters entries to [startMs, endMs] inclusive', async () => {
    const source = writeJsonl('source.jsonl', [
      { ts: 100, msg: 'before' },
      { ts: 200, msg: 'start' },
      { ts: 250, msg: 'middle' },
      { ts: 300, msg: 'end' },
      { ts: 400, msg: 'after' },
    ]);
    const out = path.join(tmpDir, 'out.log');
    const result = await sliceLogFile(
      source,
      { startMs: 200, endMs: 300 } as TimeRange,
      out,
    );

    expect(result.lineCount).toBe(3);
    const content = fs.readFileSync(out, 'utf8');
    expect(content).toBe('start\nmiddle\nend\n');
  });

  test('writes empty file when no entries match', async () => {
    const source = writeJsonl('source.jsonl', [
      { ts: 100, msg: 'before' },
      { ts: 500, msg: 'after' },
    ]);
    const out = path.join(tmpDir, 'out.log');
    const result = await sliceLogFile(
      source,
      { startMs: 200, endMs: 300 } as TimeRange,
      out,
    );

    expect(result.lineCount).toBe(0);
    expect(fs.existsSync(out)).toBe(true);
    expect(fs.readFileSync(out, 'utf8')).toBe('');
  });

  test('skips malformed lines without throwing', async () => {
    const filePath = path.join(tmpDir, 'source.jsonl');
    fs.writeFileSync(
      filePath,
      [
        JSON.stringify({ timestamp: 200, stream: 'stdout', message: 'good' }),
        'this is not valid json',
        JSON.stringify({ timestamp: 250, stream: 'stdout', message: 'also-good' }),
      ].join('\n') + '\n',
    );
    const out = path.join(tmpDir, 'out.log');
    const result = await sliceLogFile(
      filePath,
      { startMs: 100, endMs: 300 } as TimeRange,
      out,
    );

    expect(result.lineCount).toBe(2);
    expect(result.skippedLines).toBe(1);
    expect(fs.readFileSync(out, 'utf8')).toBe('good\nalso-good\n');
  });

  test('skips entries missing numeric timestamp', async () => {
    const filePath = path.join(tmpDir, 'source.jsonl');
    fs.writeFileSync(
      filePath,
      [
        JSON.stringify({ timestamp: 200, stream: 'stdout', message: 'ts-number' }),
        JSON.stringify({ stream: 'stdout', message: 'no-ts' }),
      ].join('\n') + '\n',
    );
    const out = path.join(tmpDir, 'out.log');
    const result = await sliceLogFile(
      filePath,
      { startMs: 100, endMs: 300 } as TimeRange,
      out,
    );

    expect(result.lineCount).toBe(1);
    expect(result.skippedLines).toBe(1);
  });

  test('handles empty source file', async () => {
    const source = path.join(tmpDir, 'empty.jsonl');
    fs.writeFileSync(source, '');
    const out = path.join(tmpDir, 'out.log');
    const result = await sliceLogFile(
      source,
      { startMs: 0, endMs: 1000 } as TimeRange,
      out,
    );

    expect(result.lineCount).toBe(0);
    expect(result.skippedLines).toBe(0);
  });
});