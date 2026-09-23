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
      run('Lint UI', 'success'),
      run('build / gate', 'success'),
      run('web-ui-e2e / gate', 'success'),
    ];
    const result = verifyRequiredCheckRuns(runs, SHA, [
      'Lint UI',
      'build / gate',
      'web-ui-e2e / gate',
    ]);
    expect(result.ok).toBe(true);
    expect(result.missing).toEqual([]);
    expect(result.failed).toEqual([]);
  });

  test('reports missing checks', () => {
    const runs = [run('Lint UI', 'success')];
    const result = verifyRequiredCheckRuns(runs, SHA, [
      'Lint UI',
      'build / gate',
    ]);
    expect(result.ok).toBe(false);
    expect(result.missing).toEqual(['build / gate']);
    expect(result.failed).toEqual([]);
  });

  test('reports failed checks', () => {
    const runs = [
      run('Lint UI', 'success'),
      run('build / gate', 'failure'),
    ];
    const result = verifyRequiredCheckRuns(runs, SHA, ['Lint UI', 'build / gate']);
    expect(result.ok).toBe(false);
    expect(result.missing).toEqual([]);
    expect(result.failed).toEqual(['build / gate']);
  });

  test('ignores check runs for other commits', () => {
    const runs: CheckRun[] = [
      {
        name: 'Lint UI',
        conclusion: 'success',
        head_sha: 'other-sha',
        status: 'completed',
      },
    ];
    const result = verifyRequiredCheckRuns(runs, SHA, ['Lint UI']);
    expect(result.ok).toBe(false);
    expect(result.missing).toEqual(['Lint UI']);
  });
});
