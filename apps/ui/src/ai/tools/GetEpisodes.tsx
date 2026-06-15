import { makeAssistantTool, tool } from '@assistant-ui/react'
import { getEpisodes } from '@/api/getEpisodes'
import {
  GET_EPISODES,
  GET_EPISODES_DESCRIPTION,
  getEpisodesInputSchema,
  type GetEpisodesToolOutput,
} from '@core/types/ai-tools/getEpisodes'
import { createEmptyGetEpisodesData } from '@core/ai-tool/buildGetEpisodesResponse'

const getEpisodesTool = tool({
  description: GET_EPISODES_DESCRIPTION,
  parameters: getEpisodesInputSchema,
  execute: async (
    { mediaFolderPath },
    { abortSignal },
  ): Promise<GetEpisodesToolOutput> => {
    try {
      return await getEpisodes({ mediaFolderPath }, abortSignal)
    } catch (error) {
      return {
        ...createEmptyGetEpisodesData(),
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  },
})

export const GetEpisodesTool = makeAssistantTool({
  ...getEpisodesTool,
  toolName: GET_EPISODES,
})
