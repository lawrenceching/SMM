import type { ToolDefinition } from './types'
import {
  createSuccessResponse,
  createErrorResponse,
} from '@/mcp/tools/mcpToolBase'
import { getLocalizedToolDescription } from '@/i18n/helpers'
import { resolveFolderExistence } from '@smm/core-routes'
import {
  IS_FOLDER_EXIST,
  IS_FOLDER_EXIST_DESCRIPTION,
  isFolderExistInputSchema,
  isFolderExistOutputSchema,
  type IsFolderExistOutput,
} from '@core/types/ai-tools/isFolderExist'
import { isFolderExistCheckFailed } from '@core/ai-tool/isFolderExistResult'
import { requireNonEmptyString } from '@core/ai-tool/toolResult'

export type { IsFolderExistOutput }

/**
 * Core is-folder-exist execution (no MCP wrapping). Used by agent tools.
 */
export async function executeIsFolderExist(
  path: string,
): Promise<IsFolderExistOutput> {
  const pathCheck = requireNonEmptyString(path, 'path')
  if (typeof pathCheck !== 'string') {
    return {
      exists: false,
      path: '',
      reason: pathCheck.error,
    }
  }

  try {
    return await resolveFolderExistence(pathCheck)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return isFolderExistCheckFailed(pathCheck, message)
  }
}

function createAgentIsFolderExistTool() {
  return {
    description: IS_FOLDER_EXIST_DESCRIPTION,
    inputSchema: isFolderExistInputSchema,
    outputSchema: isFolderExistOutputSchema,
    execute: async ({ path }: { path: string }) => executeIsFolderExist(path),
  }
}

export function isFolderExistAgentTool(_clientId: string) {
  return createAgentIsFolderExistTool()
}

export const getTool = async function (): Promise<ToolDefinition> {
  const description = await getLocalizedToolDescription(IS_FOLDER_EXIST)

  return {
    toolName: IS_FOLDER_EXIST,
    description,
    inputSchema: isFolderExistInputSchema,
    outputSchema: isFolderExistOutputSchema,
    execute: async ({ path }: { path: string }) => {
      try {
        const result = await executeIsFolderExist(path)
        return createSuccessResponse(
          result as unknown as { [x: string]: unknown },
        )
      } catch (error) {
        console.error('[isFolderExist] Error:', error)
        return createErrorResponse(
          error instanceof Error ? error.message : 'Unknown error',
        )
      }
    },
  }
}

export async function isFolderExistMcpTool() {
  return getTool()
}

/** @deprecated Alias — use isFolderExistAgentTool */
export const isFolderExistTool = {
  description: IS_FOLDER_EXIST_DESCRIPTION,
  inputSchema: isFolderExistInputSchema,
  execute: async ({ path }: { path: string }, abortSignal?: AbortSignal) => {
    if (abortSignal?.aborted) {
      throw new Error('Request was aborted')
    }
    return executeIsFolderExist(path)
  },
}
