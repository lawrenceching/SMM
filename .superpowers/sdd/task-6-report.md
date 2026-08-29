# Task 6 Report

## Status

Implemented the single `create-rename-episode-plan` MCP/chat tool in
`core-routes`. It calls `createRenameEpisodePlanPipeline` with the host
`appDataDir` and filesystem adapter, writes a pending AI-created plan,
broadcasts `RenameFilesPlanReady`, and returns
`END_PLAN_TASK_SUCCESS_MESSAGE` with `planId`.

The legacy begin/add/end rename tool builders and MCP handlers were removed.
The rename how-to text and CLI AI-tool registry alignment test now reference
the single tool.

## TDD

- Added MCP tests for successful plan creation with an in-memory filesystem.
- Added validation coverage for an empty `files` array.
- Added guidance coverage ensuring the how-to text names only the single tool.
- The initial red run failed because the old rename tool modules still imported
  the removed Task 4 contract; after replacement, the focused tests passed.

## Verification

- `packages/core-routes: pnpm test` — 34 files passed, 323 tests passed,
  1 skipped.
- `packages/core-routes: pnpm typecheck` — passed.
- `packages/core-routes: pnpm build` — passed.
- `apps/core: pnpm typecheck` — passed.
- `apps/cli: pnpm exec vitest run src/test/ai-tool-registry.test.ts` —
  3 tests passed.
- `git diff --check` — passed.

## Commit

`feat(core-routes): single create-rename-episode-plan MCP tool`

## Concerns

None. The pre-existing dirty E2E and documentation files were not included in
this task.

## Review fix: defaultBroadcast fallback

**Issue:** `buildCreateRenameEpisodePlanTool` used `broadcast?.(...)`, so when the
host omitted optional `config.broadcast`, the required `RenameFilesPlanReady`
event was silently skipped.

**Fix:** Restored the sibling-tool pattern (`const emit = broadcast ??
defaultBroadcast`) from `endRenameTask` / `endRecognizeTask`. Plan-ready events
now always fire via injected callback or the no-op default.

**Test:** Added `src/tools/createRenameEpisodePlan.test.ts` covering the
no-injected-callback path (spies on `defaultBroadcast`) and injected-broadcast
preference.

**Verification:** `pnpm exec vitest run src/tools/createRenameEpisodePlan.test.ts
src/mcp/createRenameEpisodePlan.test.ts` — 2 files, 5 tests passed.

**Commit:** `fix(core-routes): always broadcast RenameFilesPlanReady from create-rename-episode-plan`
