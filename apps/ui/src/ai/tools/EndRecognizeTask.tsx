import { makeAssistantTool, tool } from "@assistant-ui/react"
import { z } from 'zod'
import { END_PLAN_TASK_SUCCESS_MESSAGE } from "@core/types/ai-tools/planTaskMessages"
import { toolOk } from "@core/ai-tool/toolResult"
import { updatePlan } from "@/api/updatePlan"
import { queryClient } from "@/lib/queryClient"
import { PLANS_QUERY_ROOT } from "@/hooks/plans"
import { deletePlanDraft } from "../plan/aiPlanDrafts"
import { resolveRecognizePlanDraft } from "../plan/recognizePlanService"

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
      const plan = await resolveRecognizePlanDraft(taskId)
      if (!plan) {
        return { error: `Error Reason: Task with id "${taskId.trim()}" not found` }
      }
      if (plan.files.length === 0) {
        return { error: "Error Reason: No recognized files in task" }
      }

      const resp = await updatePlan(taskId.trim(), { status: "pending" })
      if (resp.error) {
        return { error: resp.error }
      }

      deletePlanDraft(taskId.trim())
      await queryClient.invalidateQueries({ queryKey: [PLANS_QUERY_ROOT] })

      return toolOk({ message: END_PLAN_TASK_SUCCESS_MESSAGE })
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
