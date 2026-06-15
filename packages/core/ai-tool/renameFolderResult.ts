import { Path } from '../path'
import type { RenameFolderOutput } from '../types/ai-tools/renameFolder'
import { RENAME_FOLDER_CANCELLED } from '../types/ai-tools/renameFolder'

export function renameFolderCancelled(
  from: string,
  to: string,
): RenameFolderOutput {
  return {
    renamed: false,
    from: Path.toPlatformPath(from),
    to: Path.toPlatformPath(to),
    error: RENAME_FOLDER_CANCELLED,
  }
}

export function renameFolderFailed(
  from: string,
  to: string,
  error: string,
): RenameFolderOutput {
  return {
    renamed: false,
    from: Path.toPlatformPath(from),
    to: Path.toPlatformPath(to),
    error,
  }
}

export function renameFolderSucceeded(
  from: string,
  to: string,
): RenameFolderOutput {
  return {
    renamed: true,
    from: Path.toPlatformPath(from),
    to: Path.toPlatformPath(to),
  }
}
