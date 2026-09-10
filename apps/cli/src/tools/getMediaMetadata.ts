import { stat } from 'node:fs/promises'
import { Path } from '@smm/utils/path'
import {
  createBaseGetMediaMetadataData,
  fillMediaMetadataResponseData,
} from '@smm/core/ai-tool/getMediaMetadataResponse'
import { requireNonEmptyString } from '@smm/core/ai-tool/toolResult'
import {
  GET_MEDIA_METADATA_DESCRIPTION,
  GET_MEDIA_METADATA_FOLDER_NOT_FOUND,
  GET_MEDIA_METADATA_NOT_DIRECTORY,
  GET_MEDIA_METADATA_NOT_MANAGED,
  GET_MEDIA_METADATA_NO_CACHE,
  getMediaMetadataInputSchema,
  getMediaMetadataToolOutputSchema,
  type GetMediaMetadataToolOutput,
} from '@smm/types/ai-tools/getMediaMetadata'
import { findMediaMetadata } from '@/utils/mediaMetadata'
import { getUserConfig } from '@/utils/config'

export type { GetMediaMetadataToolOutput }

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

async function executeGetMediaMetadata(
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
