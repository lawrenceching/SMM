import { Path } from '@smm/utils/path'
import {
  buildGetEpisodesResponse,
  createEmptyGetEpisodesData,
} from '@smm/core/ai-tool/buildGetEpisodesResponse'
import { requireNonEmptyString, toolOk } from '@smm/core/ai-tool/toolResult'
import {
  GET_EPISODES_DESCRIPTION,
  GET_EPISODES_INVALID_PATH,
  GET_EPISODES_NO_CACHE,
  GET_EPISODES_NOT_MANAGED,
  GET_EPISODES_NOT_TV_SHOW,
  getEpisodesInputSchema,
  getEpisodesToolOutputSchema,
  type GetEpisodesToolOutput,
} from '@smm/types/ai-tools/getEpisodes'
import { findMediaMetadata } from '@/utils/mediaMetadata'
import { getUserConfig } from '@/utils/config'
import { logger } from '../../lib/logger'

export type { GetEpisodesToolOutput }

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

async function executeGetEpisodes(
  params: { mediaFolderPath: string },
  abortSignal?: AbortSignal,
): Promise<GetEpisodesToolOutput> {
  if (abortSignal?.aborted) {
    throw new Error('Request was aborted')
  }

  const pathCheck = requireNonEmptyString(
    params.mediaFolderPath,
    'mediaFolderPath',
  )
  if (typeof pathCheck !== 'string') {
    return { ...createEmptyGetEpisodesData(), error: GET_EPISODES_INVALID_PATH }
  }

  const empty = createEmptyGetEpisodesData()

  if (!(await isMediaFolderManaged(pathCheck))) {
    return { ...empty, error: GET_EPISODES_NOT_MANAGED }
  }

  const posixPath = Path.posix(pathCheck)
  const metadata = await findMediaMetadata(posixPath)

  if (!metadata) {
    return { ...empty, error: GET_EPISODES_NO_CACHE }
  }

  if (!metadata.tvShow) {
    return { ...empty, error: GET_EPISODES_NOT_TV_SHOW }
  }

  logger.info(
    {
      mediaFolderPath: posixPath,
      seasonCount: metadata.tvShow.seasons?.length ?? 0,
      mediaFileCount: metadata.mediaFiles?.length ?? 0,
    },
    '[get-episodes] building episode list',
  )

  return toolOk(buildGetEpisodesResponse(metadata))
}


export function getEpisodesAgentTool(_clientId: string, abortSignal?: AbortSignal) {
  return {
    description: GET_EPISODES_DESCRIPTION,
    inputSchema: getEpisodesInputSchema,
    outputSchema: getEpisodesToolOutputSchema,
    execute: async (args: { mediaFolderPath: string }) => {
      return executeGetEpisodes(args, abortSignal)
    },
  }
}

