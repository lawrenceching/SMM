import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { LineBuffer, LogStore } from '../src/log-store.ts';

describe('LineBuffer', () => {
  test('emits complete lines and buffers partials', () => {
    const buf = new LineBuffer();
    const lines: string[] = [];
    const onLine = (l: string) => lines.push(l);

    buf.push('hello\nwor', onLine);
    expect(lines).toEqual(['hello']);

    buf.push('ld\nbye', onLine);
    expect(lines).toEqual(['hello', 'world']);

    buf.flush(onLine);
    expect(lines).toEqual(['hello', 'world', 'bye']);
  });

  test('strips trailing \r from \r\n line endings', () => {
    const buf = new LineBuffer();
    const lines: string[] = [];
    buf.push('line1\r\nline2\r\n', (l) => lines.push(l));
    expect(lines).toEqual(['line1', 'line2']);
  });

  test('flush is a no-op when buffer is empty', () => {
    const buf = new LineBuffer();
    const lines: string[] = [];
    buf.flush((l) => lines.push(l));
    expect(lines).toEqual([]);
  });
});

describe('LogStore', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'log-store-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('writes JSONL with timestamp, stream, message', async () => {
    const store = new LogStore(tmpDir);
    store.registerSource('test');
    store.appendChunk('test', 'stdout', Buffer.from('hello\n'));
    store.appendChunk('test', 'stderr', Buffer.from('oops\n'));
    await store.close();

    const content = fs.readFileSync(path.join(tmpDir, 'test.jsonl'), 'utf8');
    const lines = content.trim().split('\n');
    expect(lines).toHaveLength(2);

    const entry1 = JSON.parse(lines[0]!);
    expect(entry1.stream).toBe('stdout');
    expect(entry1.message).toBe('hello');
    expect(typeof entry1.timestamp).toBe('number');

    const entry2 = JSON.parse(lines[1]!);
    expect(entry2.stream).toBe('stderr');
    expect(entry2.message).toBe('oops');
  });

  test('preserves append order across chunks', async () => {
    const store = new LogStore(tmpDir);
    store.registerSource('test');
    store.appendChunk('test', 'stdout', Buffer.from('first\nsec'));
    store.appendChunk('test', 'stdout', Buffer.from('ond\nthird\n'));
    await store.close();

    const content = fs.readFileSync(path.join(tmpDir, 'test.jsonl'), 'utf8');
    const messages = content
      .trim()
      .split('\n')
      .map((l) => JSON.parse(l).message);
    expect(messages).toEqual(['first', 'second', 'third']);
  });

  test('flushes remaining buffer on close', async () => {
    const store = new LogStore(tmpDir);
    store.registerSource('test');
    store.appendChunk('test', 'stdout', Buffer.from('no-newline'));
    await store.close();

    const content = fs.readFileSync(path.join(tmpDir, 'test.jsonl'), 'utf8');
    const messages = content
      .trim()
      .split('\n')
      .map((l) => JSON.parse(l).message);
    expect(messages).toEqual(['no-newline']);
  });

  test('isolates sources into separate files', async () => {
    const store = new LogStore(tmpDir);
    store.registerSource('a');
    store.registerSource('b');
    store.appendChunk('a', 'stdout', Buffer.from('from-a\n'));
    store.appendChunk('b', 'stdout', Buffer.from('from-b\n'));
    await store.close();

    const a = fs.readFileSync(path.join(tmpDir, 'a.jsonl'), 'utf8');
    const b = fs.readFileSync(path.join(tmpDir, 'b.jsonl'), 'utf8');
    expect(JSON.parse(a.trim()).message).toBe('from-a');
    expect(JSON.parse(b.trim()).message).toBe('from-b');
  });
});