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
import { RENAME_EPISODE_FILE } from '../types/ai-tools/renameEpisodeFile'
import { SCRAPE } from '../types/ai-tools/scrape'
import { GET_JOB } from '../types/ai-tools/getJob'
import { TMDB_SEARCH } from '../types/ai-tools/tmdbSearch'
import { TMDB_GET_MOVIE } from '../types/ai-tools/tmdbGetMovie'
import { TMDB_GET_TV_SHOW } from '../types/ai-tools/tmdbGetTvShow'
import { TVDB_SEARCH } from '../types/ai-tools/tvdbSearch'
import { TVDB_GET_MOVIE } from '../types/ai-tools/tvdbGetMovie'
import { TVDB_GET_TV_SHOW } from '../types/ai-tools/tvdbGetTvShow'
import { TVDB_GET_LANGUAGES } from '../types/ai-tools/tvdbGetLanguages'
import { CREATE_RENAME_EPISODE_PLAN } from '../types/ai-tools/createRenameEpisodePlan'
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
   *
   * Plan tools (`create-rename-episode-plan`, etc.) are listed on both
   * paths but **execute on only one**: backend fs/plan APIs on
   * `AssistantChatTransport`, browser HTTP plan APIs on
   * `ReverseProxyChatTransport`. See `Assistant.tsx` conditional mount.
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
  { name: RENAME_EPISODE_FILE, backend: true, frontend: true },

  // Scrape job (no confirmation; poll with get-job)
  { name: SCRAPE, backend: true, frontend: true },
  { name: GET_JOB, backend: true, frontend: true },

  // TMDB query (Internal HTTP for Web UI / in-app AI; MCP and server chat inject Core runners)
  { name: TMDB_SEARCH, backend: true, frontend: true },
  { name: TMDB_GET_MOVIE, backend: true, frontend: true },
  { name: TMDB_GET_TV_SHOW, backend: true, frontend: true },

  // TVDB query (backend-only for now; Web UI v3 migration pending).
  // MCP and server chat inject Core runners; in-app AI via Internal HTTP.
  { name: TVDB_SEARCH, backend: true, frontend: false },
  { name: TVDB_GET_MOVIE, backend: true, frontend: false },
  { name: TVDB_GET_TV_SHOW, backend: true, frontend: false },
  { name: TVDB_GET_LANGUAGES, backend: true, frontend: false },

  // Rename episode plan
  { name: CREATE_RENAME_EPISODE_PLAN, backend: true, frontend: true },

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
