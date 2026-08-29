# Task 3 Important Findings Fix Report

## Status

Fixed metadata-root propagation and made Core metadata create/update operations atomic within the existing `MediaMetadataHelper` path mutex.

## Changes

- Added `Core.getMetadataRoot()` and used it for metadata helpers, scrape/recognition/rename/import pipelines, and plan persistence operations.
- Added `MediaMetadataHelper.createIfAbsent()` so existence check and write share one path lock.
- Added `MediaMetadataHelper.updateIfPresent()` so read-modify-write patches share one path lock.
- Added focused regressions for distinct metadata roots, concurrent creates, and concurrent non-overlapping patches.

## Verification

- Red phase: all three new regressions failed for the expected reasons.
- `pnpm exec vitest run src/Core.metadataCrud.test.ts`: 11 tests passed.
- `pnpm test` in `apps/core`: 45 files and 313 tests passed.
- `pnpm typecheck` in `apps/core`: passed.
- IDE lint diagnostics for changed TypeScript files: none.

## Residual

- Locking remains process-local, matching the existing helper design; no distributed or cross-process lock was added.
- A corrupt existing cache is not overwritten: create reports already-exists based on the physical file, while update reports not-found because the helper cannot read valid metadata.
