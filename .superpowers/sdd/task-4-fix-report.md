# Task 4 Important Findings Fix Report

## Status

Fixed metadata RPC request validation so malformed JSON, invalid Zod input, and invalid Core metadata patches return 400 validation ProblemDetails.

## Changes

- Mapped `ZodError` and malformed-JSON `SyntaxError` to `urn:smm:problem:metadata-validation`.
- Exported and matched Core metadata errors with `instanceof` instead of error-name strings.
- Required create requests to contain a plain-object `data` with `mediaFolderPath: string`.
- Restricted set patches to a strict plain object containing only `type`, `mediaFiles`, `tvShow`, and `movie`.
- Added regressions for malformed JSON, missing `mediaFolderPath`, array patches, and complete 404 ProblemDetails fields.

## Verification

- Red phase: three regressions failed as expected (malformed JSON returned 500, missing `mediaFolderPath` returned 500, and `patch: []` returned 200).
- `pnpm exec vitest run src/route/metadata`: 4 files and 8 tests passed.
- IDE lint diagnostics for changed TypeScript files: none.

## Scope

No Task 5+ code or unrelated E2E/log artifacts were changed.
