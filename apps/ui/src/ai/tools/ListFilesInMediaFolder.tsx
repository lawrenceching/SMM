import { makeAssistantTool, tool } from '@assistant-ui/react'
import { listFilesInMediaFolder } from '@/api/listFilesInMediaFolder'
import {
  createEmptyListFilesInMediaFolderData,
} from '@core/ai-tool/buildListFilesInMediaFolderResponse'
import { formatToolError } from '@core/ai-tool/toolResult'
import {
  LIST_FILES_IN_MEDIA_FOLDER,
  LIST_FILES_IN_MEDIA_FOLDER_DESCRIPTION,
  listFilesInMediaFolderInputSchema,
  type ListFilesInMediaFolderToolOutput,
} from '@core/types/ai-tools/listFilesInMediaFolder'

const listFilesInMediaFolderTool = tool({
  description: LIST_FILES_IN_MEDIA_FOLDER_DESCRIPTION,
  parameters: listFilesInMediaFolderInputSchema,
  execute: async (
    params,
    { abortSignal },
  ): Promise<ListFilesInMediaFolderToolOutput> => {
    try {
      return await listFilesInMediaFolder(params, abortSignal)
    } catch (error) {
      return {
        ...createEmptyListFilesInMediaFolderData(),
        ...formatToolError(error),
      }
    }
  },
})

export const GetFilesInMediaFolderTool = makeAssistantTool({
  ...listFilesInMediaFolderTool,
  toolName: LIST_FILES_IN_MEDIA_FOLDER,
})

/** @deprecated Use GetFilesInMediaFolderTool (tool name is list-files-in-media-folder) */
export const ListFilesInMediaFolderTool = GetFilesInMediaFolderTool
