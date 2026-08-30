import { Path } from '@core/path'
import { stat } from 'node:fs/promises'

export interface EpisodeRenamePrintResult {
  succeeded: Array<{ from: string; to: string }>
  failed: Array<{ path: string; error: string }>
}

export function isExactManagedFolder(path: string, folders: string[]): boolean {
  const targetPlatform = Path.toPlatformPath(path)
  const targetPosix = Path.posix(path)
  return folders.some(
    (folder) =>
      Path.toPlatformPath(folder) === targetPlatform || Path.posix(folder) === targetPosix,
  )
}

/** Longest POSIX prefix among managed folders that contains `filePath`. */
export function findLongestManagedFolder(
  filePath: string,
  folders: string[],
): string | null {
  const filePosix = Path.posix(filePath)
  let best: string | null = null
  let bestLen = -1
  for (const folder of folders) {
    const folderPosix = Path.posix(folder)
    const prefix = folderPosix.endsWith('/') ? folderPosix : `${folderPosix}/`
    if (filePosix === folderPosix || filePosix.startsWith(prefix)) {
      if (folderPosix.length > bestLen) {
        best = folder
        bestLen = folderPosix.length
      }
    }
  }
  return best
}

export type ClassifiedRenameTarget =
  | { kind: 'folder' }
  | { kind: 'episode'; mediaFolderPath: string }

/**
 * Decide whether `from` is a managed media-folder root or a path under one
 * (episode file). Rejects unmanaged paths and non-root directories.
 */
export async function classifyRenameTarget(
  from: string,
  folders: string[],
): Promise<ClassifiedRenameTarget> {
  if (isExactManagedFolder(from, folders)) {
    return { kind: 'folder' }
  }

  const mediaFolderPath = findLongestManagedFolder(from, folders)
  if (mediaFolderPath === null) {
    throw new Error(`${Path.posix(from)} is not under a managed media folder`)
  }

  try {
    const st = await stat(Path.toPlatformPath(from))
    if (st.isDirectory()) {
      throw new Error(
        `${Path.posix(from)} is a directory but not a managed media folder; ` +
          'only media folder roots or linked episode files can be renamed',
      )
    }
  } catch (error) {
    const code =
      error !== null && typeof error === 'object' && 'code' in error
        ? String((error as { code: unknown }).code)
        : undefined
    if (code !== 'ENOENT') {
      throw error
    }
  }

  return { kind: 'episode', mediaFolderPath }
}

export function printEpisodeRenameResult(result: EpisodeRenamePrintResult): boolean {
  for (const pair of result.succeeded) {
    console.log(`${pair.from} → ${pair.to}`)
  }
  for (const fail of result.failed) {
    console.error(`FAILED ${fail.path}: ${fail.error}`)
  }
  return result.failed.length > 0
}
