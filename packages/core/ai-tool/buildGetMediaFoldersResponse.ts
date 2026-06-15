import type { UserConfig } from '../types'
import type { GetMediaFoldersResponseData } from '../types/ai-tools/getMediaFolders'

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
