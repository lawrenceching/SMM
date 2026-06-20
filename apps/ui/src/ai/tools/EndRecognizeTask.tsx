import { makeAssistantTool, tool } from "@assistant-ui/react"
import { z } from 'zod'
import { updatePlan } from "@/api/updatePlan"
import { queryClient } from "@/lib/queryClient"
import { PLANS_QUERY_ROOT } from "@/hooks/plans"
import { getPlanDraft, deletePlanDraft } from "../plan/aiPlanDrafts"

/**
 * Frontend AI tool: `end-recognize-task`.
 *
 * Finalizes a recognize-media-file task: flips the backend plan from
 * `preparing` to `pending` (so it becomes visible to the UI via
 * `/api/getPlans`) and invalidates the plans query so the recognition
 * prompt opens. The plan lives on the backend (created via
 * `/api/createPlan`); the in-memory draft is dropped.
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
      const plan = getPlanDraft(taskId)
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

      const resp = await updatePlan(taskId, { status: "pending" })
      if (resp.error) {
        return { error: resp.error }
      }

      deletePlanDraft(taskId)
      await queryClient.invalidateQueries({ queryKey: [PLANS_QUERY_ROOT] })

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
 * Drop the in-memory draft for a plan that has been confirmed or
 * rejected. Kept for compatibility with the UI confirm/reject code
 * paths; the backend file is removed when the plan reaches a terminal
 * status via `/api/updatePlan`.
 */
export async function cleanupRecognizePlan(planId: string): Promise<void> {
  deletePlanDraft(planId)
}
