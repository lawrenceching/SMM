import { Path } from '@core/path'
import {
  buildGetEpisodesResponse,
  createEmptyGetEpisodesData,
} from '@core/ai-tool/buildGetEpisodesResponse'
import { requireNonEmptyString, toolOk } from '@core/ai-tool/toolResult'
import {
  GET_EPISODES,
  GET_EPISODES_DESCRIPTION,
  GET_EPISODES_INVALID_PATH,
  GET_EPISODES_NO_CACHE,
  GET_EPISODES_NOT_MANAGED,
  GET_EPISODES_NOT_TV_SHOW,
  getEpisodesInputSchema,
  getEpisodesToolOutputSchema,
  type GetEpisodesToolOutput,
} from '@core/types/ai-tools/getEpisodes'
import type { ToolDefinition } from './types'
import {
  createSuccessResponse,
  createErrorResponse,
} from '@/mcp/tools/mcpToolBase'
import { getLocalizedToolDescription } from '@/i18n/helpers'
import { findMediaMetadata } from '@/utils/mediaMetadata'
import { getUserConfig } from '@/utils/config'
import logger from '../../lib/logger'

export type { GetEpisodesToolOutput }
export {
  buildGetEpisodesResponse,
  createEmptyGetEpisodesData,
} from '@core/ai-tool/buildGetEpisodesResponse'
export type {
  GetEpisodesResponseData,
  GetEpisodesEpisode,
} from '@core/types/ai-tools/getEpisodes'

/** @deprecated Use GetEpisodesInput from @core/types/ai-tools/getEpisodes */
export interface GetEpisodesParams {
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

export async function executeGetEpisodes(
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

export async function handleGetEpisodes(
  params: GetEpisodesParams,
  abortSignal?: AbortSignal,
): Promise<
  ReturnType<typeof createSuccessResponse> | ReturnType<typeof createErrorResponse>
> {
  try {
    const result = await executeGetEpisodes(params, abortSignal)
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

/** @deprecated Use getEpisodesAgentTool */
export const createGetEpisodesTool = getEpisodesAgentTool

export async function getTool(): Promise<ToolDefinition> {
  const description = await getLocalizedToolDescription(GET_EPISODES)

  return {
    toolName: GET_EPISODES,
    description,
    inputSchema: getEpisodesInputSchema,
    outputSchema: getEpisodesToolOutputSchema,
    execute: async (args: { mediaFolderPath: string }) => {
      return handleGetEpisodes(args)
    },
  }
}

export async function getEpisodesMcpTool() {
  return getTool()
}
