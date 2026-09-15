# Task 3 Report: Core.stopJob and Core.getJobLog

## Status

Implemented `Core.getJobLog` and `Core.stopJob` next to `getJob` using the exact behavior and error messages from the task brief.

## Changes

- Added `getJobLog(id: string): JobLogLine[]`.
  - Throws `Job not found` for an unknown ID.
  - Returns the manager log or an empty array for an existing job.
- Added `stopJob(id: string): void`.
  - Throws `Job not found` for an unknown ID.
  - Checks kind before status and throws `Job is not abortable` for non-import jobs.
  - Throws `Job already finished` for terminal import jobs.
  - Requests stop without changing job status.
- Added the five required tests from the task brief.
- Did not add import log lines or pipeline abort behavior.

## TDD Evidence

### RED

Command:

`pnpm --filter @smm/core test -- src/Core.test.ts`

Result: exit code 1. The five new tests failed because `core.getJobLog` and `core.stopJob` were not functions. Existing tests passed (498 passed, 5 failed).

### GREEN

After implementing the two methods, the same command exited with code 0:

- 69 test files passed
- 503 tests passed
- 0 failures

## Additional Verification

- IDE lint diagnostics: no errors in `Core.ts` or `Core.test.ts`.
- `pnpm typecheck`: exit code 0.
- `pnpm build`: exit code 0.

## Concerns

None. Stop requests only set the abort flag as required; consuming that flag remains Task 4.

## Review Fix: Running Import Stop Coverage

Added a regression test that hangs `listFiles` during a TV-show import, confirms the job is
`running`, calls `stopJob(id)` without an exception, and confirms the status remains `running`.
No pipeline abort behavior or production behavior was changed.

### TDD Validation

Command:

`pnpm --filter @smm/core test -- src/Core.test.ts`

- RED (temporary production mutation): exit code 1; the new test failed with
  `expected 'aborted' to be 'running'` (503 passed, 1 failed).
- GREEN (production restored): exit code 0; 69 test files and 504 tests passed.
- IDE lint diagnostics for `apps/core/src/Core.test.ts`: no errors.
