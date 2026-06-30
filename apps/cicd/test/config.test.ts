import { describe, test, expect } from 'bun:test';
import { parseConfig, type Config } from '../src/config.ts';

describe('parseConfig', () => {
  test('accepts a minimal valid config', () => {
    const result = parseConfig({
      name: 'sample',
      tasks: [{ name: 't1', command: 'echo hi' }],
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.config.name).toBe('sample');
      expect(result.config.tasks).toHaveLength(1);
      expect(result.config.background).toEqual([]);
      expect(result.config.stopOnFailure).toBe(true);
      expect(result.config.keepRawTimeline).toBe(true);
      expect(result.config.outputDir).toBe('./artifacts/cicd');
    }
  });

  test('accepts a full config with backgrounds', () => {
    const result = parseConfig({
      name: 'e2e',
      background: [{ name: 'server', command: 'pnpm dev', delayMs: 1000 }],
      tasks: [{ name: 'test1', command: 'pnpm test', timeoutMs: 60000 }],
      outputDir: '/tmp/logs',
      stopOnFailure: false,
      keepRawTimeline: false,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.config.background[0]?.delayMs).toBe(1000);
      expect(result.config.tasks[0]?.timeoutMs).toBe(60000);
      expect(result.config.stopOnFailure).toBe(false);
      expect(result.config.keepRawTimeline).toBe(false);
      expect(result.config.outputDir).toBe('/tmp/logs');
    }
  });

  test('accepts top-level env', () => {
    const result = parseConfig({
      name: 'e2e',
      env: { FOO: 'bar', BAZ: 'qux' },
      tasks: [{ name: 't1', command: 'echo hi' }],
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.config.env).toEqual({ FOO: 'bar', BAZ: 'qux' });
    }
  });

  test('rejects missing tasks', () => {
    const result = parseConfig({ name: 'broken' });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some(e => e.path.includes('tasks'))).toBe(true);
    }
  });

  test('rejects empty tasks array', () => {
    const result = parseConfig({ name: 'broken', tasks: [] });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some(e => e.path.includes('tasks'))).toBe(true);
    }
  });

  test('rejects negative delayMs', () => {
    const result = parseConfig({
      name: 'broken',
      background: [{ name: 's', command: 'x', delayMs: -1 }],
      tasks: [{ name: 't', command: 'x' }],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some(e => e.path.includes('delayMs'))).toBe(true);
    }
  });

  test('rejects empty task name', () => {
    const result = parseConfig({
      name: 'broken',
      tasks: [{ name: '', command: 'x' }],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some(e => e.path.includes('name'))).toBe(true);
    }
  });

  test('rejects task without command', () => {
    const result = parseConfig({
      name: 'broken',
      tasks: [{ name: 't' }],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some(e => e.path.includes('command'))).toBe(true);
    }
  });

  test('returns helpful error path for nested errors', () => {
    const result = parseConfig({
      name: 'broken',
      tasks: [{ name: 't', command: 'x', timeoutMs: 0 }],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some(e => e.path === 'tasks.0.timeoutMs')).toBe(true);
    }
  });
});
