import { Path } from '../path'

export function getEpisodeBasename(filePath: string): string {
  const parts = Path.posix(filePath).split('/').filter(Boolean)
  return parts[parts.length - 1] ?? Path.posix(filePath)
}

export function buildRenameEpisodeFileConfirmationMessage(
  from: string,
  to: string,
): string {
  return (
    `Rename episode file "${getEpisodeBasename(from)}" to "${getEpisodeBasename(to)}"?\n\n` +
    'This will:\n' +
    '  • Rename the episode video on disk\n' +
    '  • Rename same-stem associated files (e.g. subtitles) in the same directory\n' +
    '  • Update media metadata'
  )
}
