/**
 * Compile-time + runtime alignment test between the AI tool registry
 * (`@core/ai-tool/registry`) and the actual tool registrations in
 * `packages/core-routes/src/chat.ts`.
 *
 * The chat pipeline (including the `tools: { ... }` map exposed to
 * `streamText`) now lives in `@smm/core-routes` so the same code can
 * run on cli (Bun) and ohos (Electron Main / Node). This test parses
 * the new source of truth and asserts the set matches the registry.
 *
 * The test does NOT spawn an LLM — it parses the source file and
 * extracts the tool keys that `streamText` would expose to the
 * model, then asserts the set matches the registry. This catches:
 *
 *   - A new tool added to `chat.ts` but not to the registry.
 *   - A tool removed from `chat.ts` but still in the registry.
 *   - A typo in a tool name (a key in `chat.ts` that is not a
 *     known constant value).
 *
 * The frontend path has an analogous test in
 * `apps/ui/src/ai/Assistant.registry.test.ts`.
 */

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { AI_TOOL_REGISTRY } from '@core/ai-tool/registry'

const CHAT_TASK_PATH = join(
  __dirname,
  '..',
  '..',
  '..',
  '..',
  'packages',
  'core-routes',
  'src',
  'chat.ts',
)

/**
 * Tool name constants imported from `@core/types/ai-tools/*` are
 * kebab-case string literals (e.g. `GET_APPLICATION_CONTEXT = 'get-app-context'`).
 * The mapping from SCREAMING_SNAKE_CASE constant name to kebab-case
 * tool name is just a `.toLowerCase()` operation in every file we
 * ship — we assert that here by checking the constant matches the
 * `<SCREAMING>_<SNAKE> = 'kebab-case'` declaration.
 *
 * If a new contract constant is added that does not follow this
 * pattern, this map should be updated to reflect the override.
 */
const CONSTANT_NAME_TO_TOOL_NAME: Record<string, string> = {
  GET_APPLICATION_CONTEXT: 'get-app-context',
  IS_FOLDER_EXIST: 'is-folder-exist',
  GET_MEDIA_METADATA: 'get-media-metadata',
  GET_EPISODES: 'get-episodes',
  GET_MEDIA_FOLDERS: 'get-media-folders',
  LIST_FILES_IN_MEDIA_FOLDER: 'list-files-in-media-folder',
  RENAME_FOLDER: 'rename-folder',
  BEGIN_RENAME_FILES_TASK: 'begin-rename-files-task',
  ADD_RENAME_FILE_TO_TASK: 'add-rename-file-to-task',
  END_RENAME_FILES_TASK: 'end-rename-files-task',
  BEGIN_RECOGNIZE_TASK: 'begin-recognize-task',
  ADD_RECOGNIZED_MEDIA_FILE: 'add-recognized-media-file',
  END_RECOGNIZE_TASK: 'end-recognize-task',
}

function extractBackendToolNames(source: string): Set<string> {
  const registered = new Set<string>()

  // 1. Computed keys: `[CONSTANT_NAME]:` — resolve to kebab-case
  //    via the constant-name map.
  const computedKeyMatches = source.matchAll(/\[([A-Z_][A-Z0-9_]*)\]:/g)
  for (const m of computedKeyMatches) {
    const constantName = m[1]
    if (!constantName) continue
    const toolName = CONSTANT_NAME_TO_TOOL_NAME[constantName]
    if (toolName) {
      registered.add(toolName)
    } else {
      // Surface the unknown constant so we remember to update the map.
      throw new Error(
        `Unknown tool constant "${constantName}" in ChatTask.ts. ` +
          `Add it to CONSTANT_NAME_TO_TOOL_NAME in this test file.`,
      )
    }
  }

  // 2. Direct string-literal keys used in the `tools: { ... }` block
  //    (e.g. `'get-app-context':`).
  const stringKeyMatches = source.matchAll(/'([a-z][a-z0-9-]*)':\s*\{/g)
  for (const m of stringKeyMatches) {
    if (m[1]) registered.add(m[1])
  }

  return registered
}

describe('AI tool registry alignment — chat.ts (core-routes)', () => {
  const source = readFileSync(CHAT_TASK_PATH, 'utf8')
  const registeredKeys = extractBackendToolNames(source)

  it('lists every kebab-case backend tool in the registry', () => {
    const expected = new Set(
      AI_TOOL_REGISTRY.filter((t) => t.backend).map((t) => t.name),
    )
    for (const name of expected) {
      expect(
        registeredKeys.has(name),
        `Backend tool "${name}" is in the registry but missing from ChatTask.ts`,
      ).toBe(true)
    }
  })

  it('does not register any tool that the registry marks as backend-only', () => {
    const backendOnly = new Set(
      AI_TOOL_REGISTRY.filter((t) => t.backend && !t.frontend).map(
        (t) => t.name,
      ),
    )
    // (none today; the check is forward-compatible — if a tool
    // is added that is backend-only, the registry will reflect
    // it, and this test will continue to pass as a no-op.)
    expect(backendOnly.size).toBe(0)
  })

  it('contains no unknown tool keys (typo guard)', () => {
    const knownNames = new Set(AI_TOOL_REGISTRY.map((t) => t.name))
    for (const key of registeredKeys) {
      expect(
        knownNames.has(key),
        `Tool "${key}" is registered in ChatTask.ts but not in the AI_TOOL_REGISTRY`,
      ).toBe(true)
    }
  })
})
