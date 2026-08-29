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
# Task 6 Report: AI tool type definitions + execution for TVDB

## What I implemented

Created 7 new files mirroring the existing TMDB analog:

1. **`packages/core/types/ai-tools/tvdbCommon.ts`** — `tvdbLanguageSchema`, `tvdbBaseUrlSchema`, `TvdbToolHostOptions`, `toTvdbCoreOptions`, `formatTvdbToolError`.
2. **`packages/core/types/ai-tools/tvdbSearch.ts`** — `TVDB_SEARCH`, `TVDB_SEARCH_DESCRIPTION`, `tvdbSearchInputSchema`/`tvdbSearchOutputSchema`, `TvdbSearchInput`/`TvdbSearchOutput`.
3. **`packages/core/types/ai-tools/tvdbGetMovie.ts`** — `TVDB_GET_MOVIE`, description, input/output schemas + types.
4. **`packages/core/types/ai-tools/tvdbGetTvShow.ts`** — `TVDB_GET_TV_SHOW`, description, input/output schemas + types.
5. **`packages/core/types/ai-tools/tvdbGetLanguages.ts`** — `TVDB_GET_LANGUAGES`, description, input/output schemas + types.
6. **`packages/core-routes/src/tools/tvdb.ts`** — runner types (`SearchInTvdbRunner`, `GetTvShowInTvdbRunner`, `GetMovieInTvdbRunner`, `GetTvdbLanguagesRunner`), `TvdbToolRunners`, `executeTvdbSearch`, `executeTvdbGetMovie`, `executeTvdbGetTvShow`, `executeTvdbGetLanguages`, `buildTvdbSearchTool`, `buildTvdbGetMovieTool`, `buildTvdbGetTvShowTool`, `buildTvdbGetLanguagesTool`.
7. **`packages/core-routes/src/tools/tvdb.test.ts`** — the test suite from the brief (8 tests).

All code was written verbatim from the task brief. The implementation uses loose `Record<string, unknown>` runner types and does NOT import from `@smm/tvdb4`, satisfying the critical constraint.

## What I tested and results

### RED (Step 2)
Before implementation, ran `pnpm vitest run src/tools/tvdb.test.ts` (from `packages/core-routes`):
- Result: **FAIL** — `Error: Cannot find module './tvdb.ts'` (module not found).

### GREEN (Step 5)
After creating the 5 type files and `tvdb.ts`:
- `pnpm vitest run src/tools/tvdb.test.ts` → **1 file passed, 8 tests passed**.
- `pnpm vitest run src/tools/tmdb.test.ts` → **1 file passed, 7 tests passed** (TMDB analog unaffected).

### Typecheck
- `pnpm run typecheck` in `packages/core-routes`: only **pre-existing** errors remain in `src/tools/tmdb.ts` (TS2352 casts, present before this task). No errors reference any of my new files.
- `pnpm run typecheck` in `packages/core`: no errors referencing any `tvdb*` file.

## Files changed

- `packages/core/types/ai-tools/tvdbCommon.ts` (new)
- `packages/core/types/ai-tools/tvdbSearch.ts` (new)
- `packages/core/types/ai-tools/tvdbGetMovie.ts` (new)
- `packages/core/types/ai-tools/tvdbGetTvShow.ts` (new)
- `packages/core/types/ai-tools/tvdbGetLanguages.ts` (new)
- `packages/core-routes/src/tools/tvdb.ts` (new)
- `packages/core-routes/src/tools/tvdb.test.ts` (new)

## Self-review findings

- Verified all files match the brief's code exactly (imports, schemas, runner types, builders).
- Verified the runner-call argument shapes against the test expectations (e.g. `toTvdbCoreOptions` produces `{ language, host }`, `host` undefined when `baseURL` absent, `type` passed through for search).
- Confirmed no `@smm/tvdb4` import anywhere in the new code.
- Scope kept to the 7 files listed in the brief — `packages/core-routes/src/tools/index.ts` integration is not part of this task (presumably a later task wires TVDB runners/tools into `ChatTools`/`ChatToolsExtraDeps`).

## Issues / concerns

- None blocking. Note: `pnpm vitest` is not resolvable from the repo root (vitest not hoisted there); the task's documented command from `packages/core-routes` (`pnpm vitest run src/tools/tvdb.test.ts`) works, and `pnpm --filter @smm/core-routes exec vitest run ...` works from the root as an alternative.
