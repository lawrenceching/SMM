import { Path } from '../path'
import { videoFileExtensions } from '../utils'
import type { ListFilesInMediaFolderResponseData } from '../types/ai-tools/listFilesInMediaFolder'

export function createEmptyListFilesInMediaFolderData(): ListFilesInMediaFolderResponseData {
  return { files: [], count: 0 }
}

function isVideoFile(filePath: string): boolean {
  const dotIndex = filePath.lastIndexOf('.')
  if (dotIndex === -1) {
    return false
  }
  const ext = filePath.substring(dotIndex).toLowerCase()
  return videoFileExtensions.includes(ext)
}

export function buildListFilesInMediaFolderResponse(
  filePaths: string[],
  videoFileOnly = false,
): ListFilesInMediaFolderResponseData {
  let files = filePaths.map((filePath) => Path.toPlatformPath(filePath))
  if (videoFileOnly) {
    files = files.filter(isVideoFile)
  }
  return {
    files,
    count: files.length,
  }
}
