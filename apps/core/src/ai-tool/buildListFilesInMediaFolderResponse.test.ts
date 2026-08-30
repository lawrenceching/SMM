import { describe, it, expect } from 'vitest'
import {
  buildListFilesInMediaFolderResponse,
  createEmptyListFilesInMediaFolderData,
} from './buildListFilesInMediaFolderResponse'

describe('buildListFilesInMediaFolderResponse', () => {
  it('maps paths to platform format and counts files', () => {
    const result = buildListFilesInMediaFolderResponse([
      '/media/show/S01E01.mkv',
      '/media/show/readme.nfo',
    ])
    expect(result.count).toBe(2)
    expect(result.files).toHaveLength(2)
  })

  it('filters to video files when videoFileOnly is true', () => {
    const result = buildListFilesInMediaFolderResponse(
      ['/media/show/S01E01.mkv', '/media/show/S01E01.nfo'],
      true,
    )
    expect(result.count).toBe(1)
    expect(result.files[0]).toMatch(/S01E01\.mkv$/)
  })

  it('createEmptyListFilesInMediaFolderData returns zeroed fields', () => {
    expect(createEmptyListFilesInMediaFolderData()).toEqual({
      files: [],
      count: 0,
    })
  })
})
