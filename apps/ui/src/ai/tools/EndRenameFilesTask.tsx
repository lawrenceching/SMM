import { makeAssistantTool, tool } from "@assistant-ui/react"
import {
  END_RENAME_FILES_TASK,
  END_RENAME_FILES_TASK_DESCRIPTION,
  endRenameFilesTaskInputSchema,
} from "@core/types/ai-tools/renameFilesTask"
import { END_PLAN_TASK_SUCCESS_MESSAGE } from "@core/types/ai-tools/planTaskMessages"
import { formatToolError, requireNonEmptyString, toolOk } from "@core/ai-tool/toolResult"
import { updatePlan } from "@/api/updatePlan"
import { queryClient } from "@/lib/queryClient"
import { PLANS_QUERY_ROOT } from "@/hooks/plans"
import { deletePlanDraft } from "../plan/aiPlanDrafts"
import { resolveRenamePlanDraft } from "../plan/renamePlanService"

const endRenameFilesTask = tool({
  description: END_RENAME_FILES_TASK_DESCRIPTION,
  parameters: endRenameFilesTaskInputSchema,
  execute: async ({ taskId }) => {
    const taskIdCheck = requireNonEmptyString(taskId, "taskId")
    if (typeof taskIdCheck !== "string") {
      return taskIdCheck
    }

    try {
      const plan = await resolveRenamePlanDraft(taskIdCheck)
      if (!plan) {
        return { error: `Error Reason: Task with id "${taskIdCheck}" not found` }
      }
      if (plan.files.length === 0) {
        return { error: "Error Reason: No rename entries in task" }
      }

      const resp = await updatePlan(taskIdCheck.trim(), { status: "pending" })
      if (resp.error) {
        return { error: resp.error }
      }

      deletePlanDraft(taskIdCheck)
      await queryClient.invalidateQueries({ queryKey: [PLANS_QUERY_ROOT] })

      return toolOk({ message: END_PLAN_TASK_SUCCESS_MESSAGE })
    } catch (error) {
      return formatToolError(error)
    }
  },
})

export const EndRenameFilesTaskTool = makeAssistantTool({
  ...endRenameFilesTask,
  toolName: END_RENAME_FILES_TASK,
})

/**
 * Drop the in-memory draft for a finalized rename plan. The backend
 * file is removed when the plan reaches a terminal status via
 * `/api/updatePlan`.
 */
export async function cleanupRenamePlan(planId: string): Promise<void> {
  deletePlanDraft(planId)
}
