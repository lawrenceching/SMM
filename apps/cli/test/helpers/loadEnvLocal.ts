import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import dotenv from 'dotenv'

/**
 * `.env.local` paths from `startDir` up to the filesystem root (nearest first).
 */
export function findEnvLocalFiles(startDir: string): string[] {
  const files: string[] = []
  let dir = resolve(startDir)
  while (true) {
    const candidate = join(dir, '.env.local')
    if (existsSync(candidate)) files.push(candidate)
    const parent = dirname(dir)
    if (parent === dir) break
    dir = parent
  }
  return files
}

/**
 * Load every `.env.local` from `startDir` to the repo/filesystem root.
 * Nearer files override farther ones. Existing `process.env` keys are not overwritten.
 */
export function loadEnvLocal(startDir: string = process.cwd()): Record<string, string> {
  const files = findEnvLocalFiles(startDir)
  const merged: Record<string, string> = {}
  for (const file of [...files].reverse()) {
    Object.assign(merged, dotenv.parse(readFileSync(file)))
  }
  for (const [key, value] of Object.entries(merged)) {
    if (process.env[key] === undefined) {
      process.env[key] = value
    }
  }
  return merged
}

export function requiredEnv(name: string): string {
  const value = process.env[name]?.trim()
  if (!value) {
    throw new Error(`${name} is not set (searched .env.local from cwd up to filesystem root)`)
  }
  return value
}
