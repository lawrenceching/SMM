import { makeAssistantTool, tool } from '@assistant-ui/react'
import {
  RENAME_EPISODE_FILE,
  RENAME_EPISODE_FILE_CONFIRMATION_TITLE,
  RENAME_EPISODE_FILE_DESCRIPTION,
  renameEpisodeFileInputSchema,
} from '@core/types/ai-tools/renameEpisodeFile'
import { buildRenameEpisodeFileConfirmationMessage } from '@core/ai-tool/renameEpisodeFileConfirm'
import {
  renameEpisodeFileCancelled,
  renameEpisodeFileFailed,
  renameEpisodeFileSucceeded,
} from '@core/ai-tool/renameEpisodeFileResult'
import { formatToolError, requireNonEmptyString, toolOk } from '@core/ai-tool/toolResult'
import { renameEpisodeFile } from '@/api/renameEpisodeFile'
import { requestConfirmation } from '../confirmationBridge'

const renameEpisodeFileTool = tool({
  description: RENAME_EPISODE_FILE_DESCRIPTION,
  parameters: renameEpisodeFileInputSchema,
  execute: async ({ mediaFolder, from, to }) => {
    const folderCheck = requireNonEmptyString(mediaFolder, 'mediaFolder')
    if (typeof folderCheck !== 'string') {
      return renameEpisodeFileFailed('', '', '', folderCheck.error)
    }
    const fromCheck = requireNonEmptyString(from, 'from')
    if (typeof fromCheck !== 'string') {
      return renameEpisodeFileFailed(folderCheck, '', '', fromCheck.error)
    }
    const toCheck = requireNonEmptyString(to, 'to')
    if (typeof toCheck !== 'string') {
      return renameEpisodeFileFailed(folderCheck, fromCheck, '', toCheck.error)
    }

    const confirmationMessage = buildRenameEpisodeFileConfirmationMessage(
      fromCheck,
      toCheck,
    )

    const confirmed = await requestConfirmation(confirmationMessage, {
      title: RENAME_EPISODE_FILE_CONFIRMATION_TITLE,
    })

    if (!confirmed) {
      return renameEpisodeFileCancelled(folderCheck, fromCheck, toCheck)
    }

    try {
      const result = await renameEpisodeFile({
        mediaFolder: folderCheck,
        from: fromCheck,
        to: toCheck,
      })
      if (result.error) {
        return renameEpisodeFileFailed(
          folderCheck,
          fromCheck,
          toCheck,
          result.error,
        )
      }
      return toolOk(
        renameEpisodeFileSucceeded(
          folderCheck,
          fromCheck,
          toCheck,
          result.data?.succeeded ?? [],
          result.data?.failed ?? [],
        ),
      )
    } catch (error) {
      return renameEpisodeFileFailed(
        folderCheck,
        fromCheck,
        toCheck,
        formatToolError(error).error,
      )
    }
  },
})

export const RenameEpisodeFileTool = makeAssistantTool({
  ...renameEpisodeFileTool,
  toolName: RENAME_EPISODE_FILE,
})
