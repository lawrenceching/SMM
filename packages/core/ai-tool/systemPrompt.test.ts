import { describe, expect, it } from 'vitest'
import { SYSTEM_PROMPT } from './systemPrompt'
import { GET_APPLICATION_CONTEXT } from '../types/ai-tools/getApplicationContext'
import { GET_MEDIA_METADATA } from '../types/ai-tools/getMediaMetadata'
import { GET_EPISODES } from '../types/ai-tools/getEpisodes'
import { LIST_FILES_IN_MEDIA_FOLDER } from '../types/ai-tools/listFilesInMediaFolder'
import { CREATE_RENAME_EPISODE_PLAN } from '../types/ai-tools/createRenameEpisodePlan'
import {
  BEGIN_RECOGNIZE_TASK,
  ADD_RECOGNIZED_MEDIA_FILE,
  END_RECOGNIZE_TASK,
} from '../types/ai-tools/recognizeMediaFileTask'
import { SCRAPE } from '../types/ai-tools/scrape'
import { GET_JOB } from '../types/ai-tools/getJob'
import { TMDB_SEARCH } from '../types/ai-tools/tmdbSearch'
import { TMDB_GET_MOVIE } from '../types/ai-tools/tmdbGetMovie'
import { TMDB_GET_TV_SHOW } from '../types/ai-tools/tmdbGetTvShow'

/**
 * The system prompt is interpolated with kebab-case tool name
 * constants. If any of these names change, this test catches the
 * drift. The prompt is also exported as `SYSTEM_PROMPT` and used
 * by both `ChatTask.ts` (backend) and `ReverseProxyChatTransport`
 * (frontend), so a typo here breaks both transports.
 */
describe('systemPrompt', () => {
  it('is a non-empty string', () => {
    expect(typeof SYSTEM_PROMPT).toBe('string')
    expect(SYSTEM_PROMPT.length).toBeGreaterThan(100)
  })

  it('references every kebab-case tool name the LLM is told to call', () => {
    const required = [
      GET_APPLICATION_CONTEXT,
      GET_MEDIA_METADATA,
      GET_EPISODES,
      LIST_FILES_IN_MEDIA_FOLDER,
      CREATE_RENAME_EPISODE_PLAN,
      BEGIN_RECOGNIZE_TASK,
      ADD_RECOGNIZED_MEDIA_FILE,
      END_RECOGNIZE_TASK,
      SCRAPE,
      GET_JOB,
      TMDB_SEARCH,
      TMDB_GET_MOVIE,
      TMDB_GET_TV_SHOW,
    ]
    for (const name of required) {
      expect(
        SYSTEM_PROMPT.includes(name),
        `System prompt does not reference tool "${name}"`,
      ).toBe(true)
    }
  })

  it('does not reference deprecated begin/add/end rename task tools', () => {
    expect(SYSTEM_PROMPT).not.toContain('begin-rename-files-task')
    expect(SYSTEM_PROMPT).not.toContain('add-rename-file-to-task')
    expect(SYSTEM_PROMPT).not.toContain('end-rename-files-task')
  })

  it('does not reference any kebab-case token that is not a known tool', () => {
    // Spot-check that we have not introduced stale tool names
    // (e.g. an old "get-selected-media-metadata" that the LLM
    // would be told to call but that has no implementation).
    expect(SYSTEM_PROMPT).not.toContain('get-selected-media-metadata')
    expect(SYSTEM_PROMPT).not.toContain('get-app-context-') // partial match guard
  })
})
