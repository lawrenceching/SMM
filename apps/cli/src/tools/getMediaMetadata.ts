import { stat } from 'node:fs/promises'
import { Path } from '@core/path'
import {
  createBaseGetMediaMetadataData,
  fillMediaMetadataResponseData,
} from '@core/ai-tool/getMediaMetadataResponse'
import { requireNonEmptyString } from '@core/ai-tool/toolResult'
import {
  GET_MEDIA_METADATA,
  GET_MEDIA_METADATA_DESCRIPTION,
  GET_MEDIA_METADATA_FOLDER_NOT_FOUND,
  GET_MEDIA_METADATA_NOT_DIRECTORY,
  GET_MEDIA_METADATA_NOT_MANAGED,
  GET_MEDIA_METADATA_NO_CACHE,
  getMediaMetadataInputSchema,
  getMediaMetadataToolOutputSchema,
  type GetMediaMetadataToolOutput,
} from '@core/types/ai-tools/getMediaMetadata'
import type { ToolDefinition } from './types'
import {
  createSuccessResponse,
  createErrorResponse,
} from '@/mcp/tools/mcpToolBase'
import { getLocalizedToolDescription } from '@/i18n/helpers'
import { findMediaMetadata } from '@/utils/mediaMetadata'
import { getUserConfig } from '@/utils/config'

export type { GetMediaMetadataToolOutput }
export {
  fillMediaMetadataResponseData,
  createBaseGetMediaMetadataData,
} from '@core/ai-tool/getMediaMetadataResponse'
export type { GetMediaMetadataResponseData } from '@core/types/ai-tools/getMediaMetadata'

/** @deprecated Use GetMediaMetadataInput from @core/types/ai-tools/getMediaMetadata */
export interface GetMediaMetadataParams {
  mediaFolderPath: string
}

async function isMediaFolderManaged(mediaFolderPath: string): Promise<boolean> {
  const userConfig = await getUserConfig()
  const targetPlatform = Path.toPlatformPath(mediaFolderPath)
  const targetPosix = Path.posix(mediaFolderPath)
  return userConfig.folders.some((folder) => {
    return (
      Path.toPlatformPath(folder) === targetPlatform ||
      Path.posix(folder) === targetPosix
    )
  })
}

export async function executeGetMediaMetadata(
  params: { mediaFolderPath: string },
  abortSignal?: AbortSignal,
): Promise<GetMediaMetadataToolOutput> {
  if (abortSignal?.aborted) {
    throw new Error('Request was aborted')
  }

  const pathCheck = requireNonEmptyString(
    params.mediaFolderPath,
    'mediaFolderPath',
  )
  if (typeof pathCheck !== 'string') {
    return {
      ...createBaseGetMediaMetadataData(''),
      error: pathCheck.error,
    }
  }

  const baseData = createBaseGetMediaMetadataData(pathCheck)

  if (!(await isMediaFolderManaged(pathCheck))) {
    return { ...baseData, error: GET_MEDIA_METADATA_NOT_MANAGED }
  }

  try {
    const normalizedPath = Path.toPlatformPath(pathCheck)

    try {
      const stats = await stat(normalizedPath)
      if (!stats.isDirectory()) {
        return { ...baseData, error: GET_MEDIA_METADATA_NOT_DIRECTORY }
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return { ...baseData, error: GET_MEDIA_METADATA_FOLDER_NOT_FOUND }
      }
      throw error
    }

    const posixPath = Path.posix(pathCheck)
    const metadata = await findMediaMetadata(posixPath)

    if (!metadata) {
      return { ...baseData, error: GET_MEDIA_METADATA_NO_CACHE }
    }

    return fillMediaMetadataResponseData(metadata, posixPath)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`Error reading media metadata: ${message}`)
  }
}

export async function handleGetMediaMetadata(
  params: { mediaFolderPath: string },
  abortSignal?: AbortSignal,
): Promise<
  ReturnType<typeof createSuccessResponse> | ReturnType<typeof createErrorResponse>
> {
  try {
    const result = await executeGetMediaMetadata(params, abortSignal)
    if (result.error) {
      const { error, ...data } = result
      return createSuccessResponse({ data, error })
    }
    return createSuccessResponse({ data: result })
  } catch (error) {
    return createErrorResponse(
      error instanceof Error ? error.message : 'Request was aborted',
    )
  }
}

export function getMediaMetadataAgentTool(
  _clientId: string,
  abortSignal?: AbortSignal,
) {
  return {
    description: GET_MEDIA_METADATA_DESCRIPTION,
    inputSchema: getMediaMetadataInputSchema,
    outputSchema: getMediaMetadataToolOutputSchema,
    execute: async (args: { mediaFolderPath: string }) => {
      return executeGetMediaMetadata(args, abortSignal)
    },
  }
}

export const getTool = async function (
  abortSignal?: AbortSignal,
): Promise<ToolDefinition> {
  const description = await getLocalizedToolDescription(GET_MEDIA_METADATA)

  return {
    toolName: GET_MEDIA_METADATA,
    description,
    inputSchema: getMediaMetadataInputSchema,
    outputSchema: getMediaMetadataToolOutputSchema,
    execute: async (args: { mediaFolderPath: string }) => {
      return handleGetMediaMetadata(args, abortSignal)
    },
  }
}

export async function getMediaMetadataMcpTool() {
  return getTool()
}
