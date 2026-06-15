import { makeAssistantTool, tool } from "@assistant-ui/react"
import { z } from 'zod'
import { readPlan, deletePlan } from "../planStore"
import { usePlansStore } from "@/stores/plansStore"
import type { UIRecognizeMediaFilePlan } from "@/types/UIRecognizeMediaFilePlan"
import { Path } from '@core/path'

/**
 * Frontend AI tool: `end-recognize-task`.
 *
 * Finalizes a recognize-media-file task and surfaces the plan to the
 * UI. The plan is read from IndexedDB (where `beginRecognizeTask` /
 * `addRecognizedMediaFile` have been writing to), converted to the
 * `UIRecognizeMediaFilePlan` shape the UI consumes, and pushed into
 * `usePlansStore` so the existing recognition-prompt components pick
 * it up and let the user review / confirm the matches.
 *
 * The plan is *also* persisted in IndexedDB after the call returns
 * so the user can navigate away and back; it is deleted from
 * IndexedDB only when the user confirms or rejects via
 * `savePlan()` in `apps/ui/src/actions/planActions.ts` (which calls
 * `updatePlan` on the backend with the new status — IndexedDB stays
 * as the local cache of the same plan).
 *
 * Mirrors the backend `createEndRecognizeTaskTool` factory in
 * `apps/cli/src/tools/recognizeMediaFilesTask.ts`, which broadcasts
 * the `RecognizeMediaFilePlanReady` Socket.IO event so the desktop
 * event listener (`RecognizeMediaFilePlanReadyEventListener`) calls
 * `fetchPlans()`. The frontend path is in-process: it does not need
 * a network round-trip to surface the plan.
 */
const endRecognizeTask = tool({
  description:
    "End a recognition task and execute the recognition. " +
    "This tool finalizes the task created by beginRecognizeTask and " +
    "processes all added media files.",
  parameters: z.object({
    taskId: z
      .string()
      .describe("The task ID returned from beginRecognizeTask."),
  }),
  execute: async ({ taskId }) => {
    if (!taskId || typeof taskId !== "string" || taskId.trim() === "") {
      return { error: "Invalid taskId: must be a non-empty string" }
    }

    try {
      const plan = await readPlan(taskId)
      if (!plan) {
        return { error: `Error Reason: Task with id "${taskId}" not found` }
      }
      if (plan.task !== "recognize-media-file") {
        return {
          error: `Error Reason: Task with id "${taskId}" is not a recognize-media-file plan`,
        }
      }
      if (plan.files.length === 0) {
        return { error: "Error Reason: No recognized files in task" }
      }

      // Push the plan into the UI's plansStore. The plan file lives
      // in IndexedDB (the browser-local source of truth for this
      // frontend path); the UI reads from plansStore directly.
      const uiPlan: UIRecognizeMediaFilePlan = {
        ...plan,
        // Path normalization for display
        mediaFolderPath: Path.toPlatformPath(plan.mediaFolderPath),
        files: plan.files.map((f) => ({
          ...f,
          path: Path.toPlatformPath(f.path),
        })),
        tmp: true,
      }

      // Append to the store; do not overwrite plans that the
      // backend may have pushed concurrently.
      usePlansStore.getState().setPlans((prev) => {
        // Replace if a plan with the same id already exists in the
        // store, otherwise append.
        const exists = prev.some((p) => p.id === plan.id)
        if (exists) {
          return prev.map((p) => (p.id === plan.id ? uiPlan : p))
        }
        return [...prev, uiPlan]
      })

      // We deliberately keep the plan in IndexedDB after the tool
      // call returns. The UI's `savePlan()` action calls
      // `updatePlan(planId, status)` on the backend; for plans
      // sourced from IndexedDB, the status update is also reflected
      // in `plansStore.setPlanById(...)` (which the UI components
      // already do on confirm/reject). IndexedDB can be cleaned up
      // on the next session or when the plan moves out of the
      // pending state.
      //
      // Note: we do NOT call deletePlan() here, because the UI may
      // still be reading the plan in subsequent render passes, and
      // `savePlan` doesn't depend on IndexedDB (it talks to the
      // backend). Cleanup of IndexedDB entries is left to a future
      // housekeeping pass.

      return { error: undefined }
    } catch (error) {
      return {
        error: `Error Reason: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      }
    }
  },
})

export const EndRecognizeTaskTool = makeAssistantTool({
  ...endRecognizeTask,
  toolName: "end-recognize-task",
})

/**
 * Helper for cleanup: drop the IndexedDB entry for a plan that has
 * been confirmed or rejected. Not exposed as a tool — called from
 * the UI's plan-action code path when it knows the plan is final.
 */
export async function cleanupRecognizePlan(planId: string): Promise<void> {
  await deletePlan(planId)
}
