import { getUserConfig } from '@/utils/config'
import {
  buildGetMediaFoldersResponse,
  createEmptyGetMediaFoldersData,
} from '@smm/core/ai-tool/buildGetMediaFoldersResponse'
import { formatToolError, toolOk } from '@smm/core/ai-tool/toolResult'
import {
  GET_MEDIA_FOLDERS_DESCRIPTION,
  getMediaFoldersInputSchema,
  getMediaFoldersOutputSchema,
  type GetMediaFoldersToolOutput,
} from '@smm/types/ai-tools/getMediaFolders'

export type { GetMediaFoldersToolOutput }

async function executeGetMediaFolders(
  abortSignal?: AbortSignal,
): Promise<GetMediaFoldersToolOutput> {
  if (abortSignal?.aborted) {
    throw new Error('Request was aborted')
  }

  try {
    const userConfig = await getUserConfig()
    return toolOk(buildGetMediaFoldersResponse(userConfig))
  } catch (error) {
    return {
      ...createEmptyGetMediaFoldersData(),
      ...formatToolError(error),
    }
  }
}


export function getMediaFoldersAgentTool(_clientId: string) {
  return {
    description: GET_MEDIA_FOLDERS_DESCRIPTION,
    inputSchema: getMediaFoldersInputSchema,
    outputSchema: getMediaFoldersOutputSchema,
    execute: async () => executeGetMediaFolders(),
  }
}


