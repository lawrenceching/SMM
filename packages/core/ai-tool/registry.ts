/**
 * AI tool registry — a single source of truth that lists every tool
 * the SMM AI Assistant exposes on each transport path (Backend
 * `ChatTask.ts` vs. Frontend `ReverseProxyChatTransport`).
 *
 * Why this exists:
 *
 * The AI tool surface is defined in **three** places that must stay
 * in lockstep:
 *   1. `apps/cli/tasks/ChatTask.ts` — server-side `streamText` tools
 *      registered in a literal `tools: { ... }` object.
 *   2. `apps/ui/src/ai/Assistant.tsx` — frontend tool React components
 *      mounted inside `<AssistantRuntimeProvider>` and collected by
 *      `useAssistantTools()`.
 *   3. The system prompt in `packages/core/ai-tool/systemPrompt.ts`
 *      that tells the LLM which tool names to call.
 *
 * Without a registry, a typo in any one of the three silently
 * produces a tool that the LLM sees a schema for but cannot invoke,
 * or a prompt instruction that references a non-existent tool.
 *
 * This module gives us a compile-time gate: a tool that is supposed
 * to be available on a path must be listed here, and the consuming
 * side can use the exported `AI_TOOL_NAMES` (union) to type-check its
 * own registrations.
 *
 * @example
 * ```ts
 * import { AI_TOOL_REGISTRY } from '@core/ai-tool/registry'
 *
 * const tools = {
 *   ...Object.fromEntries(
 *     AI_TOOL_REGISTRY
 *       .filter((t) => t.backend)
 *       .map((t) => [t.name, buildTool(t.name, ...)])
 *   ),
 * }
 * ```
 */

import { GET_APPLICATION_CONTEXT } from '../types/ai-tools/getApplicationContext'
import { IS_FOLDER_EXIST } from '../types/ai-tools/isFolderExist'
import { GET_MEDIA_METADATA } from '../types/ai-tools/getMediaMetadata'
import { GET_EPISODES } from '../types/ai-tools/getEpisodes'
import { GET_MEDIA_FOLDERS } from '../types/ai-tools/getMediaFolders'
import { LIST_FILES_IN_MEDIA_FOLDER } from '../types/ai-tools/listFilesInMediaFolder'
import { RENAME_FOLDER } from '../types/ai-tools/renameFolder'
import {
  BEGIN_RENAME_FILES_TASK,
  ADD_RENAME_FILE_TO_TASK,
  END_RENAME_FILES_TASK,
} from '../types/ai-tools/renameFilesTask'
import {
  BEGIN_RECOGNIZE_TASK,
  ADD_RECOGNIZED_MEDIA_FILE,
  END_RECOGNIZE_TASK,
} from '../types/ai-tools/recognizeMediaFileTask'

/**
 * Flags describing which transports a tool is exposed on. The LLM
 * experience is identical across paths, but the tool *implementation*
 * differs (Bun fs vs. browser IndexedDB/HTTP).
 */
export interface AiToolDescriptor {
  /** The kebab-case tool name. Must be unique across the registry. */
  readonly name: string
  /** Whether the tool is available on the Bun/Hono backend path. */
  readonly backend: boolean
  /**
   * Whether the tool is available on the in-browser
   * `ReverseProxyChatTransport` path (HarmonyOS / feature flag).
   */
  readonly frontend: boolean
}

/**
 * The complete list of tools exposed by the AI Assistant, in
 * execution order (read tools first, mutating tools last). The
 * `backend` and `frontend` flags are kept in sync with
 * `apps/cli/tasks/ChatTask.ts` and `apps/ui/src/ai/Assistant.tsx`
 * respectively.
 */
export const AI_TOOL_REGISTRY: readonly AiToolDescriptor[] = [
  // Read-only context tools
  { name: GET_APPLICATION_CONTEXT, backend: true, frontend: true },
  { name: GET_MEDIA_FOLDERS, backend: true, frontend: true },
  { name: IS_FOLDER_EXIST, backend: true, frontend: true },
  { name: GET_MEDIA_METADATA, backend: true, frontend: true },
  { name: GET_EPISODES, backend: true, frontend: true },
  { name: LIST_FILES_IN_MEDIA_FOLDER, backend: true, frontend: true },

  // Mutating tools (require user confirmation via Socket.IO / bridge)
  { name: RENAME_FOLDER, backend: true, frontend: true },

  // Rename files task
  { name: BEGIN_RENAME_FILES_TASK, backend: true, frontend: true },
  { name: ADD_RENAME_FILE_TO_TASK, backend: true, frontend: true },
  { name: END_RENAME_FILES_TASK, backend: true, frontend: true },

  // Recognize media file task
  { name: BEGIN_RECOGNIZE_TASK, backend: true, frontend: true },
  { name: ADD_RECOGNIZED_MEDIA_FILE, backend: true, frontend: true },
  { name: END_RECOGNIZE_TASK, backend: true, frontend: true },
] as const

/**
 * Union type of every AI tool name registered in {@link AI_TOOL_REGISTRY}.
 * Use this to constrain `tools: Record<...>` in `streamText` calls
 * so a typo in a key fails to type-check.
 */
export type AiToolName = (typeof AI_TOOL_REGISTRY)[number]['name']

/**
 * Returns the subset of tools exposed on a given transport path.
 * Useful for runtime validation of the `tools` object in
 * `streamText` calls.
 */
export function listToolNamesForPath(
  path: 'backend' | 'frontend',
): readonly string[] {
  return AI_TOOL_REGISTRY.filter((t) => t[path]).map((t) => t.name)
}
