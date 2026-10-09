import { existsSync } from 'node:fs'

/**
 * Detect whether the current process is running inside a Docker container.
 * Uses the presence of `/.dockerenv` (created by Docker by default).
 */
export function isRunningInDocker(): boolean {
  try {
    return existsSync('/.dockerenv')
  } catch {
    return false
  }
}
