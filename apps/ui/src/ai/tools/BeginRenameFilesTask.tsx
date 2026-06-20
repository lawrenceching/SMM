import { makeAssistantTool, tool } from "@assistant-ui/react"
import {
  BEGIN_RENAME_FILES_TASK,
  BEGIN_RENAME_FILES_TASK_DESCRIPTION,
  beginRenameFilesTaskInputSchema,
} from "@core/types/ai-tools/renameFilesTask"
import { formatToolError, requireNonEmptyString, toolOk } from "@core/ai-tool/toolResult"
import { createPlan } from "@/api/createPlan"
import { assertRenameMediaFolderOpened } from "../plan/renamePlanService"
import { setPlanDraft } from "../plan/aiPlanDrafts"

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
      const resp = await createPlan({
        task: "rename-files",
        mediaFolderPath: pathCheck,
        creator: "ai",
      })
      if (resp.error || !resp.data) {
        return { taskId: undefined, error: resp.error ?? "createPlan failed" }
      }
      setPlanDraft(resp.data.plan)
      return toolOk({ taskId: resp.data.plan.id })
    } catch (error) {
      return { taskId: undefined, ...formatToolError(error) }
    }
  },
})

export const BeginRenameFilesTaskTool = makeAssistantTool({
  ...beginRenameFilesTask,
  toolName: BEGIN_RENAME_FILES_TASK,
})
