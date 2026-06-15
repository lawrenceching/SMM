import { makeAssistantTool, tool } from "@assistant-ui/react"
import {
  ADD_RENAME_FILE_TO_TASK,
  ADD_RENAME_FILE_TO_TASK_DESCRIPTION,
  addRenameFileToTaskInputSchema,
} from "@core/types/ai-tools/renameFilesTask"
import { formatToolError, requireNonEmptyString, toolOk } from "@core/ai-tool/toolResult"
import { appendRenameEntryWithValidation } from "../plan/renamePlanService"

const addRenameFileToTask = tool({
  description: ADD_RENAME_FILE_TO_TASK_DESCRIPTION,
  parameters: addRenameFileToTaskInputSchema,
  execute: async ({ taskId, from, to }) => {
    const taskIdCheck = requireNonEmptyString(taskId, "taskId")
    if (typeof taskIdCheck !== "string") {
      return taskIdCheck
    }
    const fromCheck = requireNonEmptyString(from, "from")
    if (typeof fromCheck !== "string") {
      return fromCheck
    }
    const toCheck = requireNonEmptyString(to, "to")
    if (typeof toCheck !== "string") {
      return toCheck
    }

    try {
      const result = await appendRenameEntryWithValidation(taskIdCheck, {
        from: fromCheck,
        to: toCheck,
      })
      if ("error" in result) {
        return { error: result.error }
      }
      return toolOk({})
    } catch (error) {
      return formatToolError(error)
    }
  },
})

export const AddRenameFileToTaskTool = makeAssistantTool({
  ...addRenameFileToTask,
  toolName: ADD_RENAME_FILE_TO_TASK,
})
