# Task 3 Report: Core metadata CRUD and separate roots

## Status

Implemented the requested Core metadata CRUD API and separated user configuration storage from application metadata storage.

## Changes

- Added `Core.getMetadata(folderPath)`, which returns persisted metadata or throws `MetadataNotFoundError`.
- Added `Core.createMetadata(mm)`, which writes new metadata or throws `MetadataAlreadyExistsError`.
- Replaced the old full-document `setMetadata(mm)` API with `setMetadata(folderPath, patch)`, using Task 2's `applyMetadataPatch`.
- Added idempotent `Core.deleteMetadata(folderPath)`.
- Kept null-if-missing reads and full-document writes private to Core through `MediaMetadataHelper`.
- Wired `UserConfigHelper` to `userDataDir` and `MediaMetadataHelper` to `reportedAppDataDir ?? appDataDir`.
- Wired CLI `getCore()` with `getAppDataDir()` for application data and `getUserDataDir()` for configuration.
- Passed the split roots through the import pipeline so imports continue to read/write configuration and metadata in their respective locations.
- Migrated Core and CLI consumers away from the removed public `getMediaMetadata` and full-document `setMetadata` methods.

## TDD evidence

### RED

Command:

```bash
cd apps/core && pnpm exec vitest run src/Core.metadataCrud.test.ts
```

Result: failed as expected — 8 tests failed. The new methods were absent (`core.getMetadata is not a function`, `core.createMetadata is not a function`), and the old `setMetadata` signature rejected the new call shape.

The failing tests covered:

- get missing metadata
- create then get
- duplicate create
- patch merge
- patch missing metadata
- illegal patch key
- idempotent delete
- separate metadata/config roots

### GREEN

Command:

```bash
cd apps/core && pnpm exec vitest run src/Core.metadataCrud.test.ts
```

Result: passed — 8/8 tests.

The separate-root CLI integration test initially exposed that `ImportFolderPipeline` still used one root for both stores. After passing `userDataDir` separately, the previously failing `FolderMetadata.test.ts` passed.

## Verification

- `cd apps/core && pnpm test && pnpm typecheck`: passed, 45 files / 310 tests, followed by a clean Core TypeScript check.
- `cd apps/core && pnpm exec vitest run src/Core.metadataCrud.test.ts src/Core.test.ts`: passed, 80 tests in the required Task 3 suites.
- `cd apps/cli && pnpm exec vitest run src/cli/folderDisplay.test.ts src/route/FolderMetadata.test.ts src/route/Scrape.test.ts`: passed, 3 files / 14 tests.
- IDE lint diagnostics for edited files: no errors.

## Known concern

`apps/cli` typecheck remains blocked by existing Task 1 migration debt: several unrelated files still reference the removed `MediaMetadata.files` property. The Task 3 Core typecheck passes; Task 3 did not reimplement the prior migration.

## Commit

Planned commit message: `feat(core): metadata CRUD API and separate config/data dirs`
# Task 3 Report: Align plan HTTP appDataDir with Core

## Status

Completed and committed as `fa063cc4` (`fix(cli): use Core userDataDir for plan HTTP routes on Linux`).

## Changes

- `apps/cli/src/route/Plans.ts`: plan HTTP routes now use `getUserDataDir()`.
- `apps/cli/src/mcp/mcp.ts`: MCP plan-writing tools now use `getUserDataDir()`.
- `apps/cli/server.ts`: chat plan-writing tools now use `getUserDataDir()`.
- `apps/cli/src/route/Plans.test.ts`: added a split-directory regression test proving `/api/createPlan` writes only under `USER_DATA_DIR/plans`.

## Audit

- `apps/cli/src/route/coreRoutesConfig.ts` retains `getAppDataDir()` because its callers perform list-files, get-episodes, rename-folder, and rename-files HTTP operations rather than plan persistence. Changing it would relocate metadata-cache reads outside this task.
- Plan persistence hosts in `Plans.ts`, `mcp.ts`, and `server.ts` now match `getCore().appDataDir`.
- No second plan store was introduced.

## TDD and Verification

- RED: the focused test failed because no plan existed under `USER_DATA_DIR/plans`.
- GREEN: focused regression passed (1 test).
- Full CLI suite passed: 73 files and 474 tests; 2 files and 13 tests skipped.
- CLI `tsc --noEmit` passed.
- Changed-file lint diagnostics and `git show --check` passed.

## Self-review

- Commit contains only the three plan-host wiring changes and regression test.
- Unrelated dirty E2E and documentation files were not staged or committed.
- No correctness issues found. The core-routes `appDataDir` field is overloaded for plan and metadata dependencies in chat/MCP, but Core's directory is the required compatibility behavior for these plan-producing hosts.

## Important review follow-up

- `apps/cli/src/coreRoutesServer.ts` now supplies `getUserDataDir()` to the shared core-routes handler.
- Startup and shutdown stale-plan cleanup in `apps/cli/index.ts` now scan `userDataDir`.
- The legacy rename and recognition plan writers now store plans under `getUserDataDir()/plans`.
- Added `apps/cli/src/coreRoutesServer.test.ts`; its RED run received `/metadata/app-data`, and its GREEN run received `/core/user-data`.
- Focused plan-route tests passed: 2 files and 2 tests.
- Full CLI tests passed: 74 files and 475 tests; 2 files and 13 tests skipped.
- CLI `tsc --noEmit` and changed-file lint diagnostics passed.
