import { makeAssistantTool, tool } from "@assistant-ui/react"
import {
  BEGIN_RECOGNIZE_TASK,
  BEGIN_RECOGNIZE_TASK_DESCRIPTION,
  beginRecognizeTaskInputSchema,
} from "@core/types/ai-tools/recognizeMediaFileTask"
import { formatToolError, requireNonEmptyString, toolOk } from "@core/ai-tool/toolResult"
import { createRecognizePlan } from "../planStore"

const beginRecognizeTask = tool({
  description: BEGIN_RECOGNIZE_TASK_DESCRIPTION,
  parameters: beginRecognizeTaskInputSchema,
  execute: async ({ mediaFolderPath }) => {
    const pathCheck = requireNonEmptyString(mediaFolderPath, "mediaFolderPath")
    if (typeof pathCheck !== "string") {
      return { taskId: undefined, ...pathCheck }
    }

    try {
      const plan = await createRecognizePlan(pathCheck)
      return toolOk({ taskId: plan.id })
    } catch (error) {
      return { taskId: undefined, ...formatToolError(error) }
    }
  },
})

export const BeginRecognizeTaskTool = makeAssistantTool({
  ...beginRecognizeTask,
  toolName: BEGIN_RECOGNIZE_TASK,
})
