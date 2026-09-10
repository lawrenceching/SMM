import { makeAssistantTool, tool } from '@assistant-ui/react'
import {
  CREATE_RECOGNIZE_EPISODE_PLAN,
  CREATE_RECOGNIZE_EPISODE_PLAN_DESCRIPTION,
  createRecognizeEpisodePlanInputSchema,
} from '@smm/types/ai-tools/createRecognizeEpisodePlan'
import { END_PLAN_TASK_SUCCESS_MESSAGE } from '@smm/types/ai-tools/planTaskMessages'
import { formatToolError, toolOk } from '@smm/core/ai-tool/toolResult'
import { createRecognizeEpisodePlanApi } from '@/api/createRecognizeEpisodePlan'
import { PLANS_QUERY_ROOT } from '@/hooks/plans'
import { queryClient } from '@/lib/queryClient'

const createRecognizeEpisodePlan = tool({
  description: CREATE_RECOGNIZE_EPISODE_PLAN_DESCRIPTION,
  parameters: createRecognizeEpisodePlanInputSchema,
  execute: async ({ mediaFolderPath, files }) => {
    try {
      const resp = await createRecognizeEpisodePlanApi({
        mediaFolderPath,
        files,
        creator: 'ai',
      })
      if (resp.error || !resp.data) {
        return { error: resp.error ?? 'Error Reason: Plan creation returned no data' }
      }

      await queryClient.invalidateQueries({ queryKey: [PLANS_QUERY_ROOT] })
      return toolOk({
        message: END_PLAN_TASK_SUCCESS_MESSAGE,
        taskId: resp.data.plan.id,
      })
    } catch (error) {
      return formatToolError(error)
    }
  },
})

export const CreateRecognizeEpisodePlanTool = makeAssistantTool({
  ...createRecognizeEpisodePlan,
  toolName: CREATE_RECOGNIZE_EPISODE_PLAN,
})
