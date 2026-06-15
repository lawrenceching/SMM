import { makeAssistantTool, tool } from "@assistant-ui/react"
import {
  END_RENAME_FILES_TASK,
  END_RENAME_FILES_TASK_DESCRIPTION,
  endRenameFilesTaskInputSchema,
} from "@core/types/ai-tools/renameFilesTask"
import { toUIRenameFilesPlanPaths } from "@core/plan/renamePlan"
import { formatToolError, requireNonEmptyString, toolOk } from "@core/ai-tool/toolResult"
import { readPlan, deletePlan } from "../planStore"
import { usePlansStore } from "@/stores/plansStore"
import type { UIRenameFilesPlan } from "@/types/UIRenameFilesPlan"

const endRenameFilesTask = tool({
  description: END_RENAME_FILES_TASK_DESCRIPTION,
  parameters: endRenameFilesTaskInputSchema,
  execute: async ({ taskId }) => {
    const taskIdCheck = requireNonEmptyString(taskId, "taskId")
    if (typeof taskIdCheck !== "string") {
      return taskIdCheck
    }

    try {
      const plan = await readPlan(taskIdCheck)
      if (!plan) {
        return { error: `Error Reason: Task with id "${taskIdCheck}" not found` }
      }
      if (plan.task !== "rename-files") {
        return {
          error: `Error Reason: Task with id "${taskIdCheck}" is not a rename-files plan`,
        }
      }
      if (plan.files.length === 0) {
        return { error: "Error Reason: No rename entries in task" }
      }

      const uiPlan: UIRenameFilesPlan = {
        ...toUIRenameFilesPlanPaths(plan),
        tmp: true,
      }

      usePlansStore.getState().setPlans((prev) => {
        const exists = prev.some((p) => p.id === plan.id)
        if (exists) {
          return prev.map((p) => (p.id === plan.id ? uiPlan : p))
        }
        return [...prev, uiPlan]
      })

      return toolOk({})
    } catch (error) {
      return formatToolError(error)
    }
  },
})

export const EndRenameFilesTaskTool = makeAssistantTool({
  ...endRenameFilesTask,
  toolName: END_RENAME_FILES_TASK,
})

export async function cleanupRenamePlan(planId: string): Promise<void> {
  await deletePlan(planId)
}
