import { Path } from '../../path'
import type { RenameValidationResult } from '../../types'
import type { RenameOperation } from './types'
import { validateChainingConflicts } from './validateChainingConflicts'
import { validateNoAbnormalPaths } from './validateNoAbnormalPaths'
import { validateNoDuplicatedDestFile } from './validateNoDuplicatedDestFile'
import { validateNoDuplicatedSourceFile } from './validateNoDuplicatedSourceFile'
import { validateNoIdenticalSourceAndDestFile } from './validateNoIdenticalSourceAndDestFile'
import { validatePathWithinMediaFolder } from './validatePathWithinMediaFolder'

/**
 * Synchronous rename validation (path rules, duplicates, chaining, folder scope).
 * Filesystem existence checks are performed separately by the caller.
 */
export function validateRenameOperationsSync(
  files: RenameOperation[],
  folderPathInPosix: string,
): RenameValidationResult {
  const errors: string[] = []
  const normalizedTasks: RenameOperation[] = []
  const taskIndexMap = new Map<number, number>()

  for (let i = 0; i < files.length; i++) {
    const renameOp = files[i]
    if (!renameOp) {
      continue
    }

    taskIndexMap.set(normalizedTasks.length, i)
    normalizedTasks.push({
      from: Path.posix(renameOp.from),
      to: Path.posix(renameOp.to),
    })
  }

  if (normalizedTasks.length === 0) {
    return {
      isValid: true,
      errors: [],
      validatedRenames: [],
    }
  }

  const abnormalPathErrors = validateNoAbnormalPaths(normalizedTasks)
  if (abnormalPathErrors.length > 0) {
    errors.push(...abnormalPathErrors)
  }

  const duplicateSourceResult = validateNoDuplicatedSourceFile(normalizedTasks)
  if (!duplicateSourceResult.isValid) {
    for (const duplicatePath of duplicateSourceResult.duplicates) {
      const indices: number[] = []
      normalizedTasks.forEach((task, idx) => {
        if (task.from === duplicatePath) {
          indices.push(taskIndexMap.get(idx) ?? idx)
        }
      })
      errors.push(
        `Source file "${duplicatePath}" appears multiple times in the batch (at indices ${indices.join(', ')})`,
      )
    }
  }

  const duplicateDestResult = validateNoDuplicatedDestFile(normalizedTasks)
  if (!duplicateDestResult.isValid) {
    for (const duplicatePath of duplicateDestResult.duplicates) {
      const indices: number[] = []
      normalizedTasks.forEach((task, idx) => {
        if (task.to === duplicatePath) {
          indices.push(taskIndexMap.get(idx) ?? idx)
        }
      })
      errors.push(
        `Target file "${duplicatePath}" appears multiple times in the batch (at indices ${indices.join(', ')})`,
      )
    }
  }

  const identicalResult = validateNoIdenticalSourceAndDestFile(normalizedTasks)
  const sourcePaths = new Set<string>()
  normalizedTasks.forEach((task) => sourcePaths.add(task.from))
  const hasChainingConflicts = !validateChainingConflicts(normalizedTasks)
  const chainingConflictTasks = new Set<number>()

  if (hasChainingConflicts) {
    normalizedTasks.forEach((task, idx) => {
      if (sourcePaths.has(task.to)) {
        chainingConflictTasks.add(idx)
        errors.push(
          `Target file "${task.to}" conflicts with a source path in the same batch (cannot chain renames)`,
        )
      }
    })
  }

  const pathWithinFolderResult = validatePathWithinMediaFolder(
    folderPathInPosix,
    normalizedTasks,
  )
  if (!pathWithinFolderResult.isValid) {
    for (const invalidPath of pathWithinFolderResult.invalidPaths) {
      errors.push(
        `${invalidPath.type === 'source' ? 'Source' : 'Target'} path "${invalidPath.path}" is outside the media folder "${folderPathInPosix}"`,
      )
    }
  }

  const invalidTasks = new Set<number>()

  normalizedTasks.forEach((task, idx) => {
    const hasError =
      abnormalPathErrors.some(
        (e) => e.includes(`"${task.from}"`) || e.includes(`"${task.to}"`),
      ) ||
      duplicateSourceResult.duplicates.includes(task.from) ||
      duplicateDestResult.duplicates.includes(task.to) ||
      identicalResult.identicals.includes(task.from) ||
      pathWithinFolderResult.invalidPaths.some(
        (p) => p.path === task.from || p.path === task.to,
      ) ||
      chainingConflictTasks.has(idx)

    if (hasError) {
      invalidTasks.add(idx)
    }
  })

  const validatedRenames: RenameOperation[] = []
  normalizedTasks.forEach((task, idx) => {
    if (!invalidTasks.has(idx) && task.from !== task.to) {
      validatedRenames.push({
        from: task.from,
        to: task.to,
      })
    }
  })

  return {
    isValid: errors.length === 0,
    errors,
    validatedRenames,
  }
}
