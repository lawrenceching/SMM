import { Path } from '../../path'
import type { RenameOperation } from './types'

/**
 * Validate both "from" and "to" are within the media folder.
 */
export function validatePathWithinMediaFolder(
  mediaFolderPath: string,
  tasks: RenameOperation[],
): { isValid: boolean; invalidPaths: { path: string; type: 'source' | 'destination' }[] } {
  const invalidPaths: { path: string; type: 'source' | 'destination' }[] = []

  const mediaFolderObj = new Path(mediaFolderPath)
  const mediaFolderNormalized = mediaFolderObj.abs('posix')
  const mediaFolderWithoutDrive = mediaFolderNormalized.replace(
    /^\/[A-Za-z](?::|\/)/,
    '',
  )

  for (const task of tasks) {
    if (!task) continue

    const fromPathObj = new Path(task.from)
    const fromNormalized = fromPathObj.abs('posix')
    const fromWithoutDrive = fromNormalized.replace(/^\/[A-Za-z](?::|\/)/, '')
    if (!fromWithoutDrive.startsWith(mediaFolderWithoutDrive)) {
      invalidPaths.push({ path: task.from, type: 'source' })
    }

    const toPathObj = new Path(task.to)
    const toNormalized = toPathObj.abs('posix')
    const toWithoutDrive = toNormalized.replace(/^\/[A-Za-z](?::|\/)/, '')
    if (!toWithoutDrive.startsWith(mediaFolderWithoutDrive)) {
      invalidPaths.push({ path: task.to, type: 'destination' })
    }
  }

  return {
    isValid: invalidPaths.length === 0,
    invalidPaths,
  }
}
