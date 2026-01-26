# Design: AI-Driven Rename File V2

## Context

The app already has an **AI-driven recognition** flow (see `docs/AI-driven-recognition.md`): the AI produces a plan via `beginRecognizeTask` / `addRecognizedMediaFile` / `endRecognizeTask`, the backend stores it under `plans/`, and the UI shows a review prompt. The legacy **rename** flow uses in-memory tasks and blocks the chat until the user confirms. This design aligns rename with the recognition pattern by introducing V2 rename tools that write plans to disk and let the UI drive confirm/reject.

## Goals / Non-Goals

- **Goals:** Persist rename plans to disk; provide `beginRenameFilesTaskV2`, `addRenameFileToTaskV2`, `endRenameFilesTaskV2`; reuse “pending plan → confirm/reject” UX; leave legacy rename tools unchanged.
- **Non-Goals:** Changing or removing the existing rename tools; changing the recognition flow; adding new rename semantics (e.g. new variables or rules) beyond what the legacy flow supports.

## Decisions

### Plan storage and naming

- **Decision:** Store rename plans in the same `${userDataDir}/plans/` directory as recognition plans, using `{taskId}.plan.json`. Discriminate by `task: "rename-files"` vs `task: "recognize-media-file"`.
- **Rationale:** One plans directory, one file pattern; existing “pending plans” listing can be extended to include both plan types by filtering on `task`.
- **Alternatives considered:** Separate `rename-plans/` directory or different file suffix; rejected to keep a single place for “plans” and to simplify listing.

### Rename plan shape

- **Decision:** Introduce `RenameFilesPlan` with `id`, `task: "rename-files"`, `status: "pending" | "completed" | "rejected"`, `mediaFolderPath` (POSIX), and `files: { from: string, to: string }[]` (POSIX). Reuse the same `status` and update semantics as recognition.
- **Rationale:** Mirrors `RecognizeMediaFilePlan` so existing “get pending / update status” patterns apply with minimal branching.

### API shape for pending rename plans

- **Decision:** Prefer extending the existing “get pending plans” and “update plan” APIs to support rename plans (e.g. return a union or separate list of rename plans; accept `planId` for rename plans in update). Exact request/response schema is left to implementation (either one unified “plans” API or separate rename endpoints).
- **Rationale:** Keeps one mental model (“pending plans” and “update plan status”); UI can treat recognition and rename plans similarly. If the current API is tightly coupled to `RecognizeMediaFilePlan`, add a small adapter or a dedicated rename endpoint and document the choice in the implementation.

### Execution on confirm

- **Decision:** When the user confirms a rename plan, the frontend (or an API invoked by it) runs the same validation and batch-rename logic used by the legacy `endRenameFilesTask` path (e.g. `validateBatchRenameOperations`, `executeBatchRenameOperations`, `updateMediaMetadataAndBroadcast`). After success, call update-plan with status `"completed"`.
- **Rationale:** No duplication of rename rules or metadata update logic; only the “source of the list of renames” changes (from in-memory task to persisted plan).

### Legacy tools unchanged

- **Decision:** Do not modify `beginRenameFilesTask`, `addRenameFileToTask`, or `endRenameFilesTask` in `renameFilesTool.ts` / `renameFilesTask.ts`. Register the new V2 tools alongside them in `ChatTask.ts` so both flows are available.
- **Rationale:** Avoids regressions and allows gradual migration or A/B use of the two behaviors.

## Risks / Trade-offs

- **Two rename flows:** Callers (or docs) must be clear which tools to use (V1 vs V2). Mitigation: document V2 as the preferred flow for “plan then confirm” and keep V1 for backward compatibility.
- **Plan file growth:** Many renames in one plan mean a large JSON file. Mitigation: Accept for now; if needed later, add limits or pagination in a follow-up change.

## Migration Plan

- No migration of existing data. New behavior is additive (new tools, new plan type, new or extended APIs). Legacy rename flow remains available.
- Rollback: Remove V2 tool registration and revert any API/UI changes; existing recognition and legacy rename behavior are unaffected.

## Open Questions

- Should `getPendingPlans` return a single list of “all pending plans” (union type) or keep recognition and rename plans in separate fields? (Implementation can choose and document.)
- When the UI shows the rename review prompt, should it reuse the same prompt component as the recognition review (with a different preview), or use a dedicated rename-preview component?
