import { makeAssistantTool, tool } from '@assistant-ui/react'
import { readUserConfig } from '@/api/readUserConfig'
import {
  buildGetMediaFoldersResponse,
  createEmptyGetMediaFoldersData,
} from '@core/ai-tool/buildGetMediaFoldersResponse'
import { formatToolError, toolOk } from '@core/ai-tool/toolResult'
import {
  GET_MEDIA_FOLDERS,
  GET_MEDIA_FOLDERS_DESCRIPTION,
  getMediaFoldersInputSchema,
  type GetMediaFoldersToolOutput,
} from '@core/types/ai-tools/getMediaFolders'

const getMediaFolders = tool({
  description: GET_MEDIA_FOLDERS_DESCRIPTION,
  parameters: getMediaFoldersInputSchema,
  execute: async (): Promise<GetMediaFoldersToolOutput> => {
    try {
      const userConfig = await readUserConfig()
      return toolOk(buildGetMediaFoldersResponse(userConfig))
    } catch (error) {
      return {
        ...createEmptyGetMediaFoldersData(),
        ...formatToolError(error),
      }
    }
  },
})

export const GetMediaFoldersTool = makeAssistantTool({
  ...getMediaFolders,
  toolName: GET_MEDIA_FOLDERS,
})
