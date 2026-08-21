import { makeAssistantTool, tool } from '@assistant-ui/react'
import {
  GET_JOB,
  GET_JOB_DESCRIPTION,
  getJobInputSchema,
  type GetJobOutput,
  type JobToolPayload,
} from '@core/types/ai-tools/getJob'
import { getJobFailed, getJobSucceeded } from '@core/ai-tool/getJobResult'
import { formatToolError, requireNonEmptyString, toolOk } from '@core/ai-tool/toolResult'
import { getJob } from '@/api/getJob'

const getJobTool = tool({
  description: GET_JOB_DESCRIPTION,
  parameters: getJobInputSchema,
  execute: async ({ id }): Promise<GetJobOutput> => {
    const idCheck = requireNonEmptyString(id, 'id')
    if (typeof idCheck !== 'string') {
      return getJobFailed(idCheck.error)
    }

    try {
      const body = await getJob(idCheck)
      if (body.error) {
        return getJobFailed(body.error)
      }
      if (!body.data) {
        return getJobFailed('Error Reason: Job not found')
      }
      return toolOk(getJobSucceeded(body.data as JobToolPayload))
    } catch (error) {
      return getJobFailed(formatToolError(error).error)
    }
  },
})

export const GetJobTool = makeAssistantTool({
  ...getJobTool,
  toolName: GET_JOB,
})
