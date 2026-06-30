import { describe, test, expect } from 'bun:test';
import { ConsoleReporter } from '../src/console-reporter.ts';
import type { RunResult } from '../src/types.ts';

function makeResult(overrides: Partial<RunResult> = {}): RunResult {
  return {
    name: 'smoke',
    exitCode: 0,
    outputDir: '/tmp/cicd/1719724800',
    taskResults: [
      {
        name: 'test',
        exitCode: 0,
        startTime: 0,
        endTime: 1500,
        timedOut: false,
      },
    ],
    ...overrides,
  };
}

describe('ConsoleReporter', () => {
  test('formats a passing run with task and log sections', () => {
    const report = new ConsoleReporter().format(makeResult());

    expect(report).toContain('smoke');
    expect(report).toContain('Result: PASSED (1/1 tasks)');
    expect(report).toContain('✓ test');
    expect(report).toContain('1.5s');
    expect(report).toContain('test/main.log');
    expect(report).toContain('output: /tmp/cicd/1719724800');
  });

  test('formats a failing run with exit code and timeout', () => {
    const report = new ConsoleReporter().format(
      makeResult({
        exitCode: 1,
        taskResults: [
          {
            name: 'wait-ready',
            exitCode: 0,
            startTime: 0,
            endTime: 800,
            timedOut: false,
          },
          {
            name: 'wdio',
            exitCode: 1,
            startTime: 1000,
            endTime: 5000,
            timedOut: false,
          },
        ],
      }),
    );

    expect(report).toContain('Result: FAILED (1/2 tasks)');
    expect(report).toContain('✓ wait-ready');
    expect(report).toContain('✗ wdio');
    expect(report).toContain('exit 1');
    expect(report).toContain('wdio/main.log');
  });

  test('marks timed-out tasks', () => {
    const report = new ConsoleReporter().format(
      makeResult({
        exitCode: 1,
        taskResults: [
          {
            name: 'slow',
            exitCode: 1,
            startTime: 0,
            endTime: 10_000,
            timedOut: true,
          },
        ],
      }),
    );

    expect(report).toContain('timed out');
    expect(report).toContain('✗ slow');
  });

  test('shows relative output path when cwd is provided', () => {
    const report = new ConsoleReporter({ cwd: '/tmp/cicd' }).format(
      makeResult({ outputDir: '/tmp/cicd/1719724800' }),
    );

    expect(report).toContain('Output:');
    expect(report).toContain('  1719724800');
    expect(report).toContain('output: /tmp/cicd/1719724800');
  });

  test('formats sub-second durations in milliseconds', () => {
    const report = new ConsoleReporter().format(
      makeResult({
        taskResults: [
          {
            name: 'fast',
            exitCode: 0,
            startTime: 100,
            endTime: 250,
            timedOut: false,
          },
        ],
      }),
    );

    expect(report).toContain('150ms');
  });
});
