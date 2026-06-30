import { describe, test, expect } from 'bun:test';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildE2eConfig,
  expandSpecPatterns,
  parseWdioArgs,
  taskNamesForSpecs,
} from './build-e2e-config.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const E2E_ROOT = path.join(ROOT, 'apps/e2e');

describe('parseWdioArgs', () => {
  test('extracts --spec values and keeps other args', () => {
    expect(
      parseWdioArgs(['--spec', './test/specs/tv/*.e2e.ts', '--logLevel', 'info']),
    ).toEqual({
      specPatterns: ['./test/specs/tv/*.e2e.ts'],
      otherArgs: ['--logLevel', 'info'],
    });
  });

  test('supports --spec=value form', () => {
    expect(parseWdioArgs(['--spec=./test/specs/hello.e2e.ts'])).toEqual({
      specPatterns: ['./test/specs/hello.e2e.ts'],
      otherArgs: [],
    });
  });
});

describe('expandSpecPatterns', () => {
  test('expands a directory glob to individual spec files', () => {
    const files = expandSpecPatterns(['./test/specs/movie/*.e2e.ts'], E2E_ROOT);

    expect(files.length).toBeGreaterThan(0);
    expect(files.every((file) => file.startsWith('test/specs/movie/'))).toBe(true);
    expect(files).toContain('test/specs/movie/SearchMovie.e2e.ts');
  });

  test('expands a single spec file', () => {
    const files = expandSpecPatterns(
      ['./test/specs/hello.e2e.ts'],
      E2E_ROOT,
    );

    expect(files).toEqual(['test/specs/hello.e2e.ts']);
  });
});

describe('taskNamesForSpecs', () => {
  test('uses basename for task names', () => {
    expect(
      taskNamesForSpecs([
        'test/specs/movie/SearchMovie.e2e.ts',
        'test/specs/tv/SearchTvShow.e2e.ts',
      ]),
    ).toEqual(['SearchMovie.e2e.ts', 'SearchTvShow.e2e.ts']);
  });
});

describe('buildE2eConfig', () => {
  test('creates one wdio task per spec file', () => {
    const config = buildE2eConfig(
      ['--spec', './test/specs/movie/*.e2e.ts'],
      ROOT,
    );

    const wdioTasks = config.tasks.filter((task) => task.name !== 'wait-ready');
    expect(wdioTasks.length).toBeGreaterThan(1);
    expect(wdioTasks.every((task) => task.command.startsWith('pnpm wdio'))).toBe(
      true,
    );
    expect(wdioTasks.map((task) => task.name)).toContain('SearchMovie.e2e.ts');
  });

  test('creates a single task for one spec file', () => {
    const config = buildE2eConfig(
      ['--spec', './test/specs/hello.e2e.ts'],
      ROOT,
    );

    const wdioTasks = config.tasks.filter((task) => task.name !== 'wait-ready');
    expect(wdioTasks).toHaveLength(1);
    expect(wdioTasks[0]!.name).toBe('hello.e2e.ts');
    expect(wdioTasks[0]!.command).toContain('./test/specs/hello.e2e.ts');
  });
});
