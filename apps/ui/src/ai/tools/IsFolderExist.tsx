import { makeAssistantTool, tool } from '@assistant-ui/react'
import {
  IS_FOLDER_EXIST,
  IS_FOLDER_EXIST_DESCRIPTION,
  isFolderExistInputSchema,
  type IsFolderExistOutput,
} from '@core/types/ai-tools/isFolderExist'
import { isFolderExistSucceeded } from '@core/ai-tool/isFolderExistResult'
import { formatToolError, requireNonEmptyString, toolOk } from '@core/ai-tool/toolResult'
import { postIsFolderAvailable } from '@/api/isFolderAvailable'

const isFolderExistTool = tool({
  description: IS_FOLDER_EXIST_DESCRIPTION,
  parameters: isFolderExistInputSchema,
  execute: async ({ path: folderPath }): Promise<IsFolderExistOutput> => {
    const pathCheck = requireNonEmptyString(folderPath, 'path')
    if (typeof pathCheck !== 'string') {
      return {
        exists: false,
        path: '',
        reason: pathCheck.error,
      }
    }

    try {
      const data = await postIsFolderAvailable(pathCheck)
      if (data.available) {
        return toolOk(isFolderExistSucceeded(pathCheck))
      }
      return {
        exists: false,
        path: isFolderExistSucceeded(pathCheck).path,
        reason: data.reason ?? 'Path does not exist or is not a directory',
      }
    } catch (error) {
      return {
        exists: false,
        path: isFolderExistSucceeded(pathCheck).path,
        reason: formatToolError(error).error,
      }
    }
  },
})

export const IsFolderExistTool = makeAssistantTool({
  ...isFolderExistTool,
  toolName: IS_FOLDER_EXIST,
})
