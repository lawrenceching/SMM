# Verification Report: add-ai-driven-rename-file-v2

**Schema:** spec-driven  
**Artifacts checked:** tasks.md, design.md, proposal.md, specs/ai-tools/spec.md

---

## Summary

| Dimension    | Status |
|--------------|--------|
| Completeness | 17/17 tasks, 2 requirements with 10 scenarios |
| Correctness  | All requirements and scenarios have implementation evidence |
| Coherence    | Design followed; one minor design vs task nuance noted |

---

## Completeness

### Task completion
- **17/17** tasks marked complete in `tasks.md`.
- No incomplete checkboxes; no CRITICAL issues.

### Spec coverage (delta spec: `specs/ai-tools/spec.md`)

| Requirement / scenario | Implementation evidence |
|------------------------|-------------------------|
| **Req: AI-Driven Rename Files Task V2** | |
| Begin rename task V2 | `cli/src/tools/renameFilesToolV2.ts:49-67` (`beginRenameFilesTaskV2`), task UUID + plan ID, `plans/`, `{taskId}.plan.json`, `task: "rename-files"`, empty `files` |
| Add rename file to task V2 | `renameFilesToolV2.ts:71-90` (`addRenameFileToTaskV2`), read plan, append `{ from, to }`, write back |
| End rename task V2 and notify UI | `renameFilesToolV2.ts:105-123` (`endRenameFilesTaskV2`), broadcast `RenameFilesPlanReady`; task wrapper in `renameFilesTaskV2.ts:141-183` checks “at least one file” |
| Handle invalid task ID in V2 | `addRenameFileToTaskV2` throws “Task with id X not found”; `createEndRenameFilesTaskV2Tool` returns error; covered in `renameFilesToolV2.test.ts` and `renameFilesTaskV2.test.ts` |
| Reject empty plan in endRenameFilesTaskV2 | `renameFilesTaskV2.ts:155-158` returns error “No rename entries in task”, does not call `endRenameFilesTaskV2`; test in `renameFilesTaskV2.test.ts` |
| Rename plan file format | `core/types/RenameFilesPlan.ts`: `id`, `task: "rename-files"`, `status`, `mediaFolderPath`, `files: { from, to }[]` |
| **Req: Rename plan status update and pending list (V2)** | |
| List pending rename plans | `cli/src/route/GetPendingPlans.ts`: calls `getAllPendingRenamePlans()`, returns `renamePlans`; `renameFilesToolV2.ts:220+` filters by `task === "rename-files"` and `status === "pending"` |
| Update rename plan status | `cli/src/route/UpdatePlan.ts:32-41`: tries recognition first, then `updateRenamePlanStatus(planId, status)`; `renameFilesToolV2.ts:131-184` validates “pending” and persists |
| Frontend completes rename plan on confirm | `ui/src/components/TvShowPanel.tsx:319-333` (`handleRenamePlanConfirm`): `buildSeasonsByRenameFilesPlan` → `startToRenameFiles(seasonsFromPlan)` → on success `updatePlan(plan.id, "completed")` and `fetchPendingPlans()` |
| Frontend rejects rename plan on cancel | `TvShowPanel.tsx:349-355` (onCancel): `updatePlan(plan.id, "rejected")`; plan removal via global state filter in `global-states-provider.tsx` |

**Skipped:** None. All requirements and scenarios were checked.

---

## Correctness

### Requirement vs implementation

- **Rename plan storage:** `getPlansDir()` uses `${userDataDir}/plans/`; file name `{taskId}.plan.json`. Matches design and spec.
- **RenameFilesPlanReady:** Emitted in `renameFilesToolV2.ts:119-122` with `{ taskId, planFilePath }`. Type in `core/event-types.ts`. UI handles it in `main.tsx:169-172` and calls `fetchPendingPlans()`.
- **GetPendingPlans / UpdatePlan:** Extended as in design; `renamePlans` in response; update tries recognition then rename by `planId`.
- **Confirm path:** Reuses existing rename flow via `startToRenameFiles(seasonsOverride)` and `buildSeasonsByRenameFilesPlan`; no separate execute-rename API. Matches design and docs.

### Scenario coverage

- Begin/Add/End V2, invalid task ID, empty plan: covered by `renameFilesToolV2.test.ts` and `renameFilesTaskV2.test.ts`.
- `buildSeasonsByRenameFilesPlan`: covered in `TvShowPanelUtils.test.ts` (e.g. `describe('buildSeasonsByRenameFilesPlan')`).

No WARNINGs for missing or diverging scenarios.

---

## Coherence

### Design adherence

| Design decision | Status |
|-----------------|--------|
| Store rename plans in `${userDataDir}/plans/`, `{taskId}.plan.json`, discriminate by `task: "rename-files"` | ✅ `renameFilesToolV2.ts` |
| `RenameFilesPlan` shape: id, task, status, mediaFolderPath, files[] | ✅ `core/types/RenameFilesPlan.ts` |
| Extend get-pending-plans and update-plan for rename plans | ✅ `GetPendingPlans.ts`, `UpdatePlan.ts` |
| On confirm, run same validation and batch-rename logic | ✅ `startToRenameFiles(seasonsFromPlan)` reuses existing flow |
| Do not modify legacy rename tool implementations | ✅ `renameFilesTool.ts` / `renameFilesTask.ts` unchanged |

### Design vs task 3.3

- **Design:** “Register the new V2 tools **alongside** them in ChatTask.ts so both flows are available.”
- **Task 3.3:** “Register **only** the three V2 tools … do not modify existing …”
- **Implementation:** Only V2 tools are registered; legacy begin/add/end rename are commented out in `ChatTask.ts:121-123`.

So the code matches the task (“register only V2”), not the design (“alongside”). If the intent is to keep both flows available, legacy registration should be restored; otherwise the design doc could be updated to “register only V2.”

**SUGGESTION:** Design says “alongside” but only V2 is registered. If both flows must be available, uncomment `createBeginRenameFilesTaskTool`, `createAddRenameFileToTaskTool`, `createEndRenameFilesTaskTool` in `cli/tasks/ChatTask.ts:121-123`. If V2-only is intended, update `design.md` to say “register only the three V2 tools” instead of “alongside.”

### Code and docs consistency

- Naming and layout align with existing patterns (`renameFilesToolV2`, `renameFilesTaskV2`, plan types in `core/`).
- `docs/AI-driven-recognition.md` §10 describes the V2 rename flow, tools, data, APIs, and UI in line with the code.

---

## Issues by priority

### CRITICAL (must fix before archive)
- None.

### WARNING (should fix)
- None.

### SUGGESTION (nice to fix)

1. **Design vs registration (task 3.3)**  
   Design says “Register the new V2 tools alongside them”; task 3.3 says “register only the three V2 tools”; implementation registers only V2.  
   **Recommendation:** Either uncomment legacy rename tool registration in `cli/tasks/ChatTask.ts:121-123` and keep design as-is, or change `design.md` to state that only the three V2 rename tools are registered.

---

## Final assessment

All checks passed. No critical or warning-level issues.

One suggestion: align the “alongside” vs “register only” wording between `design.md` and task 3.3, and the current ChatTask registration.

**Verdict:** Ready for archive.
