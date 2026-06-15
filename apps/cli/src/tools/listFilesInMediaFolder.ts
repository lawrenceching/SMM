import { Path } from '@core/path'
import {
  buildListFilesInMediaFolderResponse,
  createEmptyListFilesInMediaFolderData,
} from '@core/ai-tool/buildListFilesInMediaFolderResponse'
import { formatToolError, requireNonEmptyString, toolOk } from '@core/ai-tool/toolResult'
import {
  LIST_FILES_IN_MEDIA_FOLDER_DESCRIPTION,
  LIST_FILES_IN_MEDIA_FOLDER_INVALID_PATH,
  LIST_FILES_IN_MEDIA_FOLDER_NOT_MANAGED,
  listFilesInMediaFolderInputSchema,
  listFilesInMediaFolderOutputSchema,
  type ListFilesInMediaFolderToolOutput,
} from '@core/types/ai-tools/listFilesInMediaFolder'
import { doListFiles } from '@/route/ListFiles'
import { getUserConfig } from '@/utils/config'

export type { ListFilesInMediaFolderToolOutput }
export {
  buildListFilesInMediaFolderResponse,
  createEmptyListFilesInMediaFolderData,
} from '@core/ai-tool/buildListFilesInMediaFolderResponse'

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

export async function executeListFilesInMediaFolder(
  params: {
    mediaFolderPath: string
    recursively?: boolean
    videoFileOnly?: boolean
  },
  abortSignal?: AbortSignal,
): Promise<ListFilesInMediaFolderToolOutput> {
  if (abortSignal?.aborted) {
    throw new Error('Request was aborted')
  }

  const pathCheck = requireNonEmptyString(
    params.mediaFolderPath,
    'mediaFolderPath',
  )
  if (typeof pathCheck !== 'string') {
    return {
      ...createEmptyListFilesInMediaFolderData(),
      error: LIST_FILES_IN_MEDIA_FOLDER_INVALID_PATH,
    }
  }

  const empty = createEmptyListFilesInMediaFolderData()

  if (!(await isMediaFolderManaged(pathCheck))) {
    return { ...empty, error: LIST_FILES_IN_MEDIA_FOLDER_NOT_MANAGED }
  }

  try {
    const listResult = await doListFiles({
      path: pathCheck,
      recursively: params.recursively ?? true,
      onlyFiles: true,
    })

    if (listResult.error) {
      return { ...empty, error: listResult.error }
    }

    const filePaths =
      listResult.data?.items
        .filter((item) => !item.isDirectory)
        .map((item) => item.path) ?? []

    return toolOk(
      buildListFilesInMediaFolderResponse(
        filePaths,
        params.videoFileOnly ?? false,
      ),
    )
  } catch (error) {
    return {
      ...empty,
      ...formatToolError(error),
    }
  }
}

export function listFilesInMediaFolderAgentTool(_clientId: string) {
  return {
    description: LIST_FILES_IN_MEDIA_FOLDER_DESCRIPTION,
    inputSchema: listFilesInMediaFolderInputSchema,
    outputSchema: listFilesInMediaFolderOutputSchema,
    execute: async (args: {
      mediaFolderPath: string
      recursively?: boolean
      videoFileOnly?: boolean
    }) => executeListFilesInMediaFolder(args),
  }
}

/** @deprecated Use listFilesInMediaFolderAgentTool */
export const listFilesAgentTool = listFilesInMediaFolderAgentTool
