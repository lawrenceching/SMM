import { z } from 'zod'
import type { ToolDefinition } from './types'
import {
  createSuccessResponse,
  createErrorResponse,
} from '@/mcp/tools/mcpToolBase'
import { getLocalizedToolDescription } from '@/i18n/helpers'
import { doListFiles } from '@/route/ListFiles'
import {
  buildListFilesInMediaFolderResponse,
  createEmptyListFilesInMediaFolderData,
} from '@core/ai-tool/buildListFilesInMediaFolderResponse'
import { formatToolError } from '@core/ai-tool/toolResult'

export interface ListFilesMcpParams {
  folderPath: string
  recursive?: boolean
  filter?: string
  videoFileOnly?: boolean
}

/**
 * Generic filesystem listing for MCP `list-files` (no managed-folder check).
 * Prefer `list-files-in-media-folder` for AI Assistant media workflows.
 */
export async function executeListFilesMcp(
  params: ListFilesMcpParams,
  abortSignal?: AbortSignal,
): Promise<
  ReturnType<typeof createSuccessResponse> | ReturnType<typeof createErrorResponse>
> {
  if (abortSignal?.aborted) {
    return createErrorResponse('Request was aborted')
  }

  const { folderPath, recursive, videoFileOnly } = params
  const empty = createEmptyListFilesInMediaFolderData()

  if (!folderPath || typeof folderPath !== 'string' || folderPath.trim() === '') {
    return createErrorResponse(
      'Invalid path: path must be a non-empty string',
    )
  }

  try {
    const listResult = await doListFiles({
      path: folderPath,
      recursively: recursive ?? false,
      onlyFiles: true,
    })

    if (listResult.error) {
      return createErrorResponse(listResult.error)
    }

    const filePaths =
      listResult.data?.items
        .filter((item) => !item.isDirectory)
        .map((item) => item.path) ?? []

    const data = buildListFilesInMediaFolderResponse(
      filePaths,
      videoFileOnly ?? false,
    )
    return createSuccessResponse(data)
  } catch (error) {
    const message = formatToolError(error).error
    return createErrorResponse(message)
  }
}

const listFilesMcpInputSchema = z.object({
  folderPath: z
    .string()
    .describe('The absolute path of the folder to list files from'),
  recursive: z
    .boolean()
    .optional()
    .default(false)
    .describe('Whether to list files recursively (default: false)'),
  filter: z
    .string()
    .optional()
    .describe('Filter pattern for files/folders (supports wildcards)'),
  videoFileOnly: z
    .boolean()
    .optional()
    .default(false)
    .describe('Whether to return only video files (default: false)'),
})

export async function listFilesMcpTool(): Promise<ToolDefinition> {
  const description = await getLocalizedToolDescription('list-files')

  return {
    toolName: 'list-files',
    description,
    inputSchema: listFilesMcpInputSchema,
    outputSchema: z.object({
      files: z.array(z.string()).describe('Array of file paths'),
      count: z.number().describe('Number of files listed'),
    }),
    execute: async (args: ListFilesMcpParams) => executeListFilesMcp(args),
  }
}

/** @deprecated Use executeListFilesInMediaFolder from listFilesInMediaFolder.ts */
export const listFilesTool = {
  description:
    'List all files in a folder recursively. Accepts paths in POSIX or Windows format.',
  inputSchema: listFilesMcpInputSchema,
  execute: async (
    { folderPath, recursive, videoFileOnly }: ListFilesMcpParams,
    abortSignal?: AbortSignal,
  ) => {
    const result = await executeListFilesMcp(
      { folderPath, recursive, videoFileOnly },
      abortSignal,
    )
    if (result.isError) {
      throw new Error(result.content[0]?.text ?? 'Unknown error')
    }
    return result.structuredContent as {
      files: string[]
      count: number
    }
  },
}
