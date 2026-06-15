import { makeAssistantTool, tool } from '@assistant-ui/react'
import {
  RENAME_FOLDER,
  RENAME_FOLDER_CONFIRMATION_TITLE,
  RENAME_FOLDER_DESCRIPTION,
  renameFolderInputSchema,
} from '@core/types/ai-tools/renameFolder'
import { buildRenameFolderConfirmationMessage } from '@core/ai-tool/renameFolderConfirm'
import {
  renameFolderCancelled,
  renameFolderFailed,
  renameFolderSucceeded,
} from '@core/ai-tool/renameFolderResult'
import { formatToolError, requireNonEmptyString, toolOk } from '@core/ai-tool/toolResult'
import { postRenameFolder } from '@/api/renameFolder'
import { requestConfirmation } from '../confirmationBridge'

const renameFolderTool = tool({
  description: RENAME_FOLDER_DESCRIPTION,
  parameters: renameFolderInputSchema,
  execute: async ({ from, to }) => {
    const fromCheck = requireNonEmptyString(from, 'from')
    if (typeof fromCheck !== 'string') {
      return renameFolderFailed('', '', fromCheck.error)
    }
    const toCheck = requireNonEmptyString(to, 'to')
    if (typeof toCheck !== 'string') {
      return renameFolderFailed(fromCheck, '', toCheck.error)
    }

    const confirmationMessage = buildRenameFolderConfirmationMessage(
      fromCheck,
      toCheck,
    )

    const confirmed = await requestConfirmation(confirmationMessage, {
      title: RENAME_FOLDER_CONFIRMATION_TITLE,
    })

    if (!confirmed) {
      return renameFolderCancelled(fromCheck, toCheck)
    }

    try {
      const result = await postRenameFolder({ from: fromCheck, to: toCheck })
      if (result.error) {
        return renameFolderFailed(fromCheck, toCheck, result.error)
      }
      return toolOk(renameFolderSucceeded(fromCheck, toCheck))
    } catch (error) {
      return renameFolderFailed(
        fromCheck,
        toCheck,
        formatToolError(error).error,
      )
    }
  },
})

export const RenameFolderTool = makeAssistantTool({
  ...renameFolderTool,
  toolName: RENAME_FOLDER,
})
