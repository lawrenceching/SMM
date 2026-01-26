# Change: Add AI-Driven Rename File V2

## Why

The existing rename flow (`beginRenameFilesTask`, `addRenameFileToTask`, `endRenameFilesTask`) uses in-memory state and blocks the chat until the user confirms in a real-time prompt. This does not match the **AI-driven recognition** pattern described in `docs/AI-driven-recognition.md`, where the AI produces a plan, the backend persists it, and the UI shows a review prompt that the user can act on when ready. A V2 rename flow aligned with that pattern will:

1. Persist rename plans to disk so they survive server restarts
2. Not block the AI chat while waiting for user confirmation
3. Reuse the same “pending plan → confirm/reject” UX as recognition (optional real-time notification via Socket.IO)

Legacy rename tools remain unchanged for backward compatibility.

## What Changes

- Add three new AI tools: `beginRenameFilesTaskV2`, `addRenameFileToTaskV2`, `endRenameFilesTaskV2` that follow the plan-on-disk pattern from `docs/AI-driven-recognition.md`
- Introduce `RenameFilesPlan` and plan storage under `${userDataDir}/plans/` (same directory as recognition plans, discriminated by `task: "rename-files"`)
- Add `RenameFilesPlanReady` Socket.IO event when a rename plan is ready for review
- Extend backend support for “pending plans” so rename plans can be listed and updated (reject/complete) alongside recognition plans, or via dedicated endpoints as chosen in design
- Add UI flow to show a rename-plan review prompt when a pending rename plan matches the current media folder, with confirm (execute renames and mark completed) and cancel (reject plan)
- Leave existing `beginRenameFilesTask`, `addRenameFileToTask`, and `endRenameFilesTask` implementations untouched

## Impact

- Affected specs: `ai-tools`
- Affected code:
  - `core/types/` – New `RenameFilesPlan` (and related) types
  - `core/event-types.ts` – `RenameFilesPlanReady` event
  - `cli/src/tools/` – New `renameFilesToolV2.ts` (or equivalent) and `renameFilesTaskV2.ts` for plan I/O and AI tool wrappers
  - `cli/tasks/ChatTask.ts` – Register the three V2 tools only; legacy tools remain
  - Backend routes – Extend or add get-pending-plans and update-plan support for rename plans
  - `ui/` – Pending rename plans state, API calls, and TV Show panel (or shared) prompt for rename-plan review and apply/reject
