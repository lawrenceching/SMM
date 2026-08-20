import { Path } from '@core/path'

/**
 * Resolve CLI `--from` / `--to` against the media folder.
 * Absolute paths (POSIX or Windows) are normalized; relative paths
 * are joined under `folder`.
 */
export function resolvePathUnderMediaFolder(
  folder: string,
  filePath: string,
): string {
  const trimmed = filePath.trim()
  const folderPosix = Path.posix(folder)

  if (
    trimmed.startsWith('/') ||
    /^[A-Za-z]:[/\\]/.test(trimmed) ||
    trimmed.startsWith('\\\\')
  ) {
    return Path.posix(trimmed)
  }

  const relative = trimmed.replace(/\\/g, '/').replace(/^\.\//, '')
  const prefix = folderPosix.endsWith('/') ? folderPosix : `${folderPosix}/`
  return Path.posix(`${prefix}${relative}`)
}
