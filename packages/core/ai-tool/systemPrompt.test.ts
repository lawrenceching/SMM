import { describe, expect, it } from 'vitest'
import { SYSTEM_PROMPT } from './systemPrompt'
import { GET_APPLICATION_CONTEXT } from '../types/ai-tools/getApplicationContext'
import { GET_MEDIA_METADATA } from '../types/ai-tools/getMediaMetadata'
import { GET_EPISODES } from '../types/ai-tools/getEpisodes'
import { LIST_FILES_IN_MEDIA_FOLDER } from '../types/ai-tools/listFilesInMediaFolder'
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
      BEGIN_RENAME_FILES_TASK,
      ADD_RENAME_FILE_TO_TASK,
      END_RENAME_FILES_TASK,
      BEGIN_RECOGNIZE_TASK,
      ADD_RECOGNIZED_MEDIA_FILE,
      END_RECOGNIZE_TASK,
    ]
    for (const name of required) {
      expect(
        SYSTEM_PROMPT.includes(name),
        `System prompt does not reference tool "${name}"`,
      ).toBe(true)
    }
  })

  it('does not reference any kebab-case token that is not a known tool', () => {
    // Spot-check that we have not introduced stale tool names
    // (e.g. an old "get-selected-media-metadata" that the LLM
    // would be told to call but that has no implementation).
    expect(SYSTEM_PROMPT).not.toContain('get-selected-media-metadata')
    expect(SYSTEM_PROMPT).not.toContain('get-app-context-') // partial match guard
  })
})
