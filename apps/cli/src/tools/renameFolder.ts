import { Path } from '@core/path'
import {
  buildRenameFolderConfirmationMessage,
} from '@core/ai-tool/renameFolderConfirm'
import {
  renameFolderCancelled,
  renameFolderFailed,
  renameFolderSucceeded,
} from '@core/ai-tool/renameFolderResult'
import { requireNonEmptyString } from '@core/ai-tool/toolResult'
import {
  RENAME_FOLDER,
  RENAME_FOLDER_DESCRIPTION,
  renameFolderInputSchema,
  renameFolderOutputSchema,
  type RenameFolderOutput,
} from '@core/types/ai-tools/renameFolder'
import type { ToolDefinition } from './types'
import {
  createSuccessResponse,
  createErrorResponse,
} from '@/mcp/tools/mcpToolBase'
import { acknowledge } from '@/utils/socketIO'
import logger from '../../lib/logger'
import { getLocalizedToolDescription } from '@/i18n/helpers'
import { doRenameFolder } from '@/route/RenameFolder'

export interface RenameFolderParams {
  from: string
  to: string
}

function toMcpResponse(result: RenameFolderOutput) {
  if (result.error && !result.renamed) {
    return createSuccessResponse(result)
  }
  if (result.renamed) {
    return createSuccessResponse(result)
  }
  return createSuccessResponse(result)
}

/**
 * Core rename-folder execution (no confirmation). Used by MCP and agent after confirm.
 */
export async function executeRenameFolder(
  params: RenameFolderParams,
  abortSignal?: AbortSignal,
): Promise<RenameFolderOutput> {
  logger.info(
    { params, file: 'tools/renameFolder.ts' },
    `[tool][${RENAME_FOLDER}] started`,
  )

  if (abortSignal?.aborted) {
    logger.info(
      { file: 'tools/renameFolder.ts' },
      `[tool][${RENAME_FOLDER}] aborted`,
    )
    throw new Error('Request was aborted')
  }

  const fromCheck = requireNonEmptyString(params.from, 'from')
  if (typeof fromCheck !== 'string') {
    return renameFolderFailed('', '', fromCheck.error)
  }
  const toCheck = requireNonEmptyString(params.to, 'to')
  if (typeof toCheck !== 'string') {
    return renameFolderFailed(fromCheck, '', toCheck.error)
  }

  try {
    const result = await doRenameFolder({ from: fromCheck, to: toCheck })

    if (result.error) {
      logger.info(
        { from: fromCheck, to: toCheck, error: result.error },
        `[tool][${RENAME_FOLDER}] doRenameFolder error`,
      )
      return renameFolderFailed(fromCheck, toCheck, result.error)
    }

    const success = renameFolderSucceeded(fromCheck, toCheck)
    logger.info(
      { params, response: success },
      `[tool][${RENAME_FOLDER}] succeeded`,
    )
    return success
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    logger.error(
      { params, error: message },
      `[tool][${RENAME_FOLDER}] unexpected error`,
    )
    return renameFolderFailed(
      fromCheck,
      toCheck,
      `Error renaming folder: ${message}`,
    )
  }
}

/** @deprecated Use executeRenameFolder — kept for MCP registration */
export async function handleRenameFolder(
  params: RenameFolderParams,
  abortSignal?: AbortSignal,
): Promise<
  ReturnType<typeof createSuccessResponse> | ReturnType<typeof createErrorResponse>
> {
  try {
    const result = await executeRenameFolder(params, abortSignal)
    return toMcpResponse(result)
  } catch (error) {
    return createErrorResponse(
      error instanceof Error ? error.message : 'Request was aborted',
    )
  }
}

async function confirmRenameFolderViaSocket(
  clientId: string,
  from: string,
  to: string,
): Promise<RenameFolderOutput | null> {
  const confirmationMessage = buildRenameFolderConfirmationMessage(from, to)

  try {
    const responseData = await acknowledge({
      event: 'askForConfirmation',
      data: { message: confirmationMessage },
      clientId,
    })

    const confirmed =
      responseData?.confirmed ?? responseData?.response === 'yes'

    if (!confirmed) {
      return renameFolderCancelled(from, to)
    }
    return null
  } catch (error) {
    return renameFolderFailed(
      from,
      to,
      `Failed to get user confirmation: ${
        error instanceof Error ? error.message : 'Unknown error'
      }`,
    )
  }
}

function createAgentRenameFolderTool(
  clientId: string,
  abortSignal?: AbortSignal,
) {
  return {
    description: RENAME_FOLDER_DESCRIPTION,
    inputSchema: renameFolderInputSchema,
    outputSchema: renameFolderOutputSchema,
    execute: async (args: RenameFolderParams): Promise<RenameFolderOutput> => {
      if (abortSignal?.aborted) {
        throw new Error('Request was aborted')
      }

      const fromCheck = requireNonEmptyString(args.from, 'from')
      if (typeof fromCheck !== 'string') {
        return renameFolderFailed('', '', fromCheck.error)
      }
      const toCheck = requireNonEmptyString(args.to, 'to')
      if (typeof toCheck !== 'string') {
        return renameFolderFailed(fromCheck, '', toCheck.error)
      }

      const cancelOrError = await confirmRenameFolderViaSocket(
        clientId,
        fromCheck,
        toCheck,
      )
      if (cancelOrError) {
        return cancelOrError
      }

      if (abortSignal?.aborted) {
        throw new Error('Request was aborted')
      }

      return executeRenameFolder(
        { from: fromCheck, to: toCheck },
        abortSignal,
      )
    },
  }
}

export function renameFolderAgentTool(
  clientId: string,
  abortSignal?: AbortSignal,
) {
  return createAgentRenameFolderTool(clientId, abortSignal)
}

/** @deprecated Alias of renameFolderAgentTool */
export const createRenameFolderTool = renameFolderAgentTool

export const getTool = async function (
  abortSignal?: AbortSignal,
): Promise<ToolDefinition> {
  const description = await getLocalizedToolDescription(RENAME_FOLDER)

  return {
    toolName: RENAME_FOLDER,
    description,
    inputSchema: renameFolderInputSchema,
    outputSchema: renameFolderOutputSchema,
    execute: async (args: RenameFolderParams) => {
      return handleRenameFolder(args, abortSignal)
    },
  }
}

export async function renameFolderMcpTool() {
  return getTool()
}
