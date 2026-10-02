import type { FolderType, RenameRuleName } from '@smm/core'

const FOLDER_TYPES: readonly FolderType[] = ['tvshow', 'movie', 'music']
const RENAME_RULES: readonly RenameRuleName[] = ['plex', 'emby']

export function resolveFolderType(value: string): FolderType {
  if (value === 'anime') return 'tvshow'
  if ((FOLDER_TYPES as readonly string[]).includes(value)) {
    return value as FolderType
  }
  throw new Error(`Invalid folder type: ${value}`)
}

export function resolveRenameRule(value: string): RenameRuleName {
  if ((RENAME_RULES as readonly string[]).includes(value)) {
    return value as RenameRuleName
  }
  throw new Error(`Unsupported rename rule: ${value}`)
}

/** Parse CLI value as JSON when possible; otherwise keep the raw string. */
export function parseConfigValue(raw: string): unknown {
  try {
    return JSON.parse(raw)
  } catch {
    return raw
  }
}

export function printJson(value: unknown): void {
  console.log(JSON.stringify(value, null, 2))
}
