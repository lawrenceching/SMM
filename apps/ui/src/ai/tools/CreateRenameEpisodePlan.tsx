import { makeAssistantTool, tool } from '@assistant-ui/react'
import {
  CREATE_RENAME_EPISODE_PLAN,
  CREATE_RENAME_EPISODE_PLAN_DESCRIPTION,
  createRenameEpisodePlanInputSchema,
} from '@core/types/ai-tools/createRenameEpisodePlan'
import { END_PLAN_TASK_SUCCESS_MESSAGE } from '@core/types/ai-tools/planTaskMessages'
import { formatToolError, toolOk } from '@core/ai-tool/toolResult'
import { createRenameEpisodePlanApi } from '@/api/createRenameEpisodePlan'
import { PLANS_QUERY_ROOT } from '@/hooks/plans'
import { queryClient } from '@/lib/queryClient'

const createRenameEpisodePlan = tool({
  description: CREATE_RENAME_EPISODE_PLAN_DESCRIPTION,
  parameters: createRenameEpisodePlanInputSchema,
  execute: async ({ mediaFolderPath, files }) => {
    try {
      const resp = await createRenameEpisodePlanApi({
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

export const CreateRenameEpisodePlanTool = makeAssistantTool({
  ...createRenameEpisodePlan,
  toolName: CREATE_RENAME_EPISODE_PLAN,
})
