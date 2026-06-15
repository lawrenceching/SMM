import { describe, it, expect, vi } from 'vitest'
import {
  createEmptyRenamePlan,
  assertEpisodeVideoFile,
  prepareAppendRenameEntry,
} from './renamePlan'
import type { MediaMetadata } from '../types'

describe('renamePlan', () => {
  it('createEmptyRenamePlan normalizes folder path', () => {
    const plan = createEmptyRenamePlan('C:\\media\\show')
    expect(plan.task).toBe('rename-files')
    expect(plan.status).toBe('pending')
    expect(plan.files).toEqual([])
    expect(plan.id).toBeTruthy()
    expect(plan.mediaFolderPath).not.toContain('\\')
  })

  it('assertEpisodeVideoFile fails when file is not in metadata', () => {
    const metadata = {
      mediaFiles: [{ absolutePath: '/media/show/S01E01.mp4' }],
    } as MediaMetadata
    expect(assertEpisodeVideoFile(metadata, '/media/show/other.mp4')).toBeDefined()
  })

  it('prepareAppendRenameEntry delegates validation to deps', async () => {
    const plan = createEmptyRenamePlan('/media/show')
    const validateOperations = vi.fn(async () => ({
      isValid: false,
      errors: ['bad'],
      validatedRenames: [],
    }))
    const result = await prepareAppendRenameEntry(
      plan,
      { from: '/media/show/a.mp4', to: '/media/show/b.mp4' },
      {
        validateOperations,
        getMediaMetadata: async () => null,
      },
    )
    expect('error' in result).toBe(true)
    if ('error' in result) {
      expect(result.error).toContain('bad')
    }
  })
})
