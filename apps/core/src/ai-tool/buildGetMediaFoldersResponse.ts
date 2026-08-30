import type { UserConfig } from '@smm/types'
import type { GetMediaFoldersResponseData } from '@smm/types/ai-tools/getMediaFolders'

export function createEmptyGetMediaFoldersData(): GetMediaFoldersResponseData {
  return { folders: [] }
}

export function buildGetMediaFoldersResponse(
  userConfig: UserConfig,
): GetMediaFoldersResponseData {
  return {
    folders: userConfig.folders ?? [],
  }
}
