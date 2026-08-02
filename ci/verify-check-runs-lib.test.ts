import { describe, expect, test } from 'bun:test';
import {
  verifyRequiredCheckRuns,
  type CheckRun,
} from './verify-check-runs-lib';

const SHA = 'abc123';

function run(name: string, conclusion: string | null): CheckRun {
  return {
    name,
    conclusion,
    head_sha: SHA,
    status: conclusion ? 'completed' : 'in_progress',
  };
}

describe('verifyRequiredCheckRuns', () => {
  test('passes when every required check succeeded on sha', () => {
    const runs = [
      run('Run Unit Tests', 'success'),
      run('Lint UI', 'success'),
      run('host-e2e / gate', 'success'),
    ];
    const result = verifyRequiredCheckRuns(runs, SHA, [
      'Run Unit Tests',
      'Lint UI',
      'host-e2e / gate',
    ]);
    expect(result.ok).toBe(true);
    expect(result.missing).toEqual([]);
    expect(result.failed).toEqual([]);
  });

  test('reports missing checks', () => {
    const runs = [run('Run Unit Tests', 'success')];
    const result = verifyRequiredCheckRuns(runs, SHA, [
      'Run Unit Tests',
      'Lint UI',
    ]);
    expect(result.ok).toBe(false);
    expect(result.missing).toEqual(['Lint UI']);
    expect(result.failed).toEqual([]);
  });

  test('reports failed checks', () => {
    const runs = [
      run('Run Unit Tests', 'success'),
      run('Lint UI', 'failure'),
    ];
    const result = verifyRequiredCheckRuns(runs, SHA, ['Run Unit Tests', 'Lint UI']);
    expect(result.ok).toBe(false);
    expect(result.missing).toEqual([]);
    expect(result.failed).toEqual(['Lint UI']);
  });

  test('ignores check runs for other commits', () => {
    const runs: CheckRun[] = [
      {
        name: 'Run Unit Tests',
        conclusion: 'success',
        head_sha: 'other-sha',
        status: 'completed',
      },
    ];
    const result = verifyRequiredCheckRuns(runs, SHA, ['Run Unit Tests']);
    expect(result.ok).toBe(false);
    expect(result.missing).toEqual(['Run Unit Tests']);
  });
});
