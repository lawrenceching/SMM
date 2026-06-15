import { Path } from '../path'

export function getFolderBasename(folderPath: string): string {
  const parts = Path.posix(folderPath).split('/').filter(Boolean)
  return parts[parts.length - 1] ?? Path.posix(folderPath)
}

export function buildRenameFolderConfirmationMessage(
  from: string,
  to: string,
): string {
  return (
    `Rename folder "${getFolderBasename(from)}" to "${getFolderBasename(to)}"?\n\n` +
    'This will:\n  • Rename the folder on disk\n  • Update media metadata'
  )
}
