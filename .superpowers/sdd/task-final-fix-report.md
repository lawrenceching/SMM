# Final whole-branch review fixes

## Fixed

- Migrated `McpOther-RenameTaskFlow` and `McpPrompt-CancelPreparingPlan` from the removed begin/add/end MCP rename flow to one-shot `create-rename-episode-plan` calls with non-empty `files`.
- Replaced the e2e `McpClient` begin/add/end rename helpers and request/response types with `createRenameEpisodePlan`.
- Updated MCP documentation, CLI tool-description localization registration, and English/Chinese locale descriptions for `create-rename-episode-plan`; removed obsolete rename tool descriptions.
- Removed the dead `renameFilesPlanReady` Debug API documentation and deleted the unreferenced legacy `renameFilesTool.ts`.
- Left the app-data-directory architecture unchanged for follow-up work.

## Test evidence

- `pnpm --filter e2e typecheck` — passed.
- `bun ci/run-e2e-test.ts --spec ./common/mcp/McpOther-RenameTaskFlow.e2e.ts` — passed (artifact `artifacts/cicd/1788022664`).
- `bun ci/run-e2e-test.ts --spec ./common/mcp/McpPrompt-CancelPreparingPlan.e2e.ts` — passed (artifact `artifacts/cicd/1788022711`).
- `git diff --check` — passed.
- `pnpm --filter cli typecheck` — blocked by existing `Response.json(): unknown` assertions in `debugCreateRenameEpisodePlan.test.ts` and `RenameEpisodesPlan.test.ts`; no reported error was in a file changed by this fix.
