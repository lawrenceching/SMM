import { Path } from '../../path'
import type { RenameOperation } from './types'

function isPathNormal(p: string): boolean {
  if (p.startsWith('../')) {
    return true
  }

  if (p.includes('/..') || p.includes('/./') || p.endsWith('/.')) {
    return false
  }

  const platform = Path.toPlatformPath(p)
  const posix = Path.posix(platform)
  const parts = posix.split('/').filter((part) => part.length > 0)
  const resolved: string[] = []

  for (const part of parts) {
    if (part === '..') {
      if (resolved.length === 0) {
        return false
      }
      resolved.pop()
    } else if (part !== '.') {
      resolved.push(part)
    }
  }

  const normalized =
    posix.startsWith('/') || /^\/[A-Za-z]:/.test(posix)
      ? (posix.startsWith('/') ? '/' : '') + resolved.join('/')
      : resolved.join('/')

  return normalized === posix || normalized === platform
}

/**
 * Validate there is NO abnormal paths that contains character like ".."
 * which is risky for path validation.
 */
export function validateNoAbnormalPaths(tasks: RenameOperation[]): string[] {
  const errors: string[] = []
  for (const task of tasks) {
    if (!task) continue
    if (!isPathNormal(task.from)) {
      errors.push(`Source path "${task.from}" is abnormal`)
    }
    if (!isPathNormal(task.to)) {
      errors.push(`Destination path "${task.to}" is abnormal`)
    }
  }
  return errors
}
