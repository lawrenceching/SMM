## 1. Core types and events

- [x] 1.1 Add `RenameFilesPlan` and `RenameFileEntry` in `core/types/` (e.g. `RenameFilesPlan.ts`), with `task: "rename-files"`, `status`, `mediaFolderPath`, `files: { from, to }[]` (paths in POSIX)
- [x] 1.2 Add `RenameFilesPlanReady` event and request data type in `core/event-types.ts`

## 2. Backend: plan storage and V2 tool layer

- [x] 2.1 Create `cli/src/tools/renameFilesToolV2.ts` (or equivalent) with:
  - [x] `beginRenameFilesTaskV2(mediaFolderPath)` – create plan file in `${userDataDir}/plans/`, return taskId
  - [x] `addRenameFileToTaskV2(taskId, from, to)` – append entry to plan file
  - [x] `endRenameFilesTaskV2(taskId)` – persist plan and broadcast `RenameFilesPlanReady`
  - [x] `getRenameTask(taskId)` – return plan or undefined
  - [x] `updateRenamePlanStatus(planId, status)` and `getAllPendingRenamePlans()` – for API and UI (or integrate with existing plan APIs per design)
- [x] 2.2 Reuse or ensure `plans/` directory and `{taskId}.plan.json` naming; discriminate by `plan.task === "rename-files"`

## 3. Backend: AI tool wrappers and registration

- [x] 3.1 Create `cli/src/tools/renameFilesTaskV2.ts` with:
  - [x] `createBeginRenameFilesTaskV2Tool(clientId, abortSignal)`
  - [x] `createAddRenameFileToTaskV2Tool(clientId, abortSignal)`
  - [x] `createEndRenameFilesTaskV2Tool(clientId, abortSignal)`
- [x] 3.2 Export V2 tools from `cli/src/tools/index.ts`
- [x] 3.3 In `cli/tasks/ChatTask.ts`, register only the three V2 tools (`beginRenameFilesTaskV2`, `addRenameFileToTaskV2`, `endRenameFilesTaskV2`); do not modify existing `beginRenameFilesTask`, `addRenameFileToTask`, `endRenameFilesTask`

## 4. Backend: HTTP API for pending rename plans

- [x] 4.1 Extend `getPendingPlans` (or add `getPendingRenamePlans`) to include pending rename plans and return them in the response format agreed in design
- [x] 4.2 Ensure `updatePlan` (or add `updateRenamePlan`) accepts `planId` and `status` for rename plans and updates the corresponding plan file

## 5. Frontend: state, API, and review flow

- [x] 5.1 Extend global state (or add) to hold pending rename plans and to fetch/update them (mirroring recognition flow)
- [x] 5.2 When a pending rename plan matches the current media folder, show a rename-plan review prompt with preview (from/to pairs) and Confirm/Cancel
- [x] 5.3 On Confirm: execute renames (reuse existing batch-rename/validation logic where applicable), then call update-plan with status completed
- [x] 5.4 On Cancel: call update-plan with status rejected
- [ ] 5.5 Optionally handle `RenameFilesPlanReady` in WebSocket handler to refetch pending rename plans

## 6. Tests and docs

- [x] 6.1 Add unit tests for V2 plan storage and tool layer
- [ ] 6.2 Add unit tests for V2 AI tool wrappers
- [x] 6.3 Update or add documentation (e.g. `docs/AI-driven-recognition.md` or a new doc) to describe the AI-driven rename file V2 flow
