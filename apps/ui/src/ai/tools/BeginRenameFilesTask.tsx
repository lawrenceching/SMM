import { makeAssistantTool, tool } from "@assistant-ui/react"
import {
  BEGIN_RENAME_FILES_TASK,
  BEGIN_RENAME_FILES_TASK_DESCRIPTION,
  beginRenameFilesTaskInputSchema,
} from "@core/types/ai-tools/renameFilesTask"
import { formatToolError, requireNonEmptyString, toolOk } from "@core/ai-tool/toolResult"
import { createRenamePlan } from "../planStore"
import { assertRenameMediaFolderOpened } from "../plan/renamePlanService"

const beginRenameFilesTask = tool({
  description: BEGIN_RENAME_FILES_TASK_DESCRIPTION,
  parameters: beginRenameFilesTaskInputSchema,
  execute: async ({ mediaFolderPath }) => {
    const pathCheck = requireNonEmptyString(mediaFolderPath, "mediaFolderPath")
    if (typeof pathCheck !== "string") {
      return { taskId: undefined, ...pathCheck }
    }

    const metadataError = await assertRenameMediaFolderOpened(pathCheck)
    if (metadataError) {
      return { taskId: undefined, error: metadataError }
    }

    try {
      const plan = await createRenamePlan(pathCheck)
      return toolOk({ taskId: plan.id })
    } catch (error) {
      return { taskId: undefined, ...formatToolError(error) }
    }
  },
})

export const BeginRenameFilesTaskTool = makeAssistantTool({
  ...beginRenameFilesTask,
  toolName: BEGIN_RENAME_FILES_TASK,
})
