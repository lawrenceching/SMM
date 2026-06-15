import type { ToolDefinition } from './types'
import {
  createSuccessResponse,
  createErrorResponse,
} from '@/mcp/tools/mcpToolBase'
import { getLocalizedToolDescription } from '@/i18n/helpers'
import { getUserConfig } from '@/utils/config'
import {
  buildGetMediaFoldersResponse,
  createEmptyGetMediaFoldersData,
} from '@core/ai-tool/buildGetMediaFoldersResponse'
import { formatToolError, toolOk } from '@core/ai-tool/toolResult'
import {
  GET_MEDIA_FOLDERS,
  GET_MEDIA_FOLDERS_DESCRIPTION,
  getMediaFoldersDataSchema,
  getMediaFoldersInputSchema,
  getMediaFoldersOutputSchema,
  type GetMediaFoldersToolOutput,
} from '@core/types/ai-tools/getMediaFolders'

export type { GetMediaFoldersToolOutput }
export {
  buildGetMediaFoldersResponse,
  createEmptyGetMediaFoldersData,
} from '@core/ai-tool/buildGetMediaFoldersResponse'

export async function executeGetMediaFolders(
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

async function handleGetMediaFolders(
  abortSignal?: AbortSignal,
): Promise<
  ReturnType<typeof createSuccessResponse> | ReturnType<typeof createErrorResponse>
> {
  try {
    const result = await executeGetMediaFolders(abortSignal)
    if (result.error) {
      return createErrorResponse(result.error)
    }
    const { error: _error, ...data } = result
    return createSuccessResponse(data)
  } catch (error) {
    return createErrorResponse(
      error instanceof Error ? error.message : 'Request was aborted',
    )
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

export async function getMediaFoldersMcpTool(): Promise<ToolDefinition> {
  const description = await getLocalizedToolDescription(GET_MEDIA_FOLDERS)

  return {
    toolName: GET_MEDIA_FOLDERS,
    description,
    inputSchema: getMediaFoldersInputSchema,
    outputSchema: getMediaFoldersDataSchema,
    execute: async () => handleGetMediaFolders(),
  }
}

/** @deprecated Use executeGetMediaFolders; returns bare folder paths for legacy callers */
export const getMediaFoldersTool = {
  description: GET_MEDIA_FOLDERS_DESCRIPTION,
  inputSchema: getMediaFoldersInputSchema,
  execute: async (_args: Record<string, never>, abortSignal?: AbortSignal) => {
    const result = await executeGetMediaFolders(abortSignal)
    if (result.error) {
      throw new Error(result.error)
    }
    return result.folders
  },
}
