import { describe, expect, it, vi } from 'vitest'
import {
  createImportLibraryTasks,
  dedupLibraryFolders,
  importLibraryJobProgress,
  prepareLibraryFoldersForImport,
} from './importLibrary'

describe('dedupLibraryFolders', () => {
  it('removes folders already imported (POSIX comparison)', () => {
    const result = dedupLibraryFolders(
      ['/lib/Show1', '/lib/Show2'],
      ['/lib/Show1'],
    )
    expect(result).toEqual(['/lib/Show2'])
  })

  it('returns all folders when none are imported', () => {
    const folders = ['/lib/A', '/lib/B']
    expect(dedupLibraryFolders(folders, [])).toEqual(folders)
  })
})

describe('prepareLibraryFoldersForImport', () => {
  it('writes blank metadata for each folder before batch upserting UserConfig', async () => {
    const order: string[] = []
    const writeBlankMetadata = vi.fn(async (metadata: { mediaFolderPath?: string }) => {
      order.push(`metadata:${metadata.mediaFolderPath}`)
    })
    const upsertFolders = vi.fn(async (folders: string[]) => {
      order.push(`config:${folders.join(',')}`)
    })

    await prepareLibraryFoldersForImport(['/lib/A', '/lib/B'], 'music', {
      writeBlankMetadata,
      upsertFolders,
    })

    expect(order).toEqual(['metadata:/lib/A', 'metadata:/lib/B', 'config:/lib/A,/lib/B'])
    expect(writeBlankMetadata).toHaveBeenCalledTimes(2)
    expect(upsertFolders).toHaveBeenCalledWith(['/lib/A', '/lib/B'])
  })

  it('skips UserConfig upsert when there are no folders', async () => {
    const upsertFolders = vi.fn()
    await prepareLibraryFoldersForImport([], 'music', {
      writeBlankMetadata: vi.fn(),
      upsertFolders,
    })
    expect(upsertFolders).not.toHaveBeenCalled()
  })
})

describe('createImportLibraryTasks', () => {
  it('creates pending tasks for each folder path', () => {
    const tasks = createImportLibraryTasks('job-1', ['/lib/A', '/lib/B'])
    expect(tasks).toEqual([
      { id: 'job-1-task-0', path: '/lib/A', status: 'pending' },
      { id: 'job-1-task-1', path: '/lib/B', status: 'pending' },
    ])
  })
})

describe('importLibraryJobProgress', () => {
  it('returns percentage of completed tasks', () => {
    expect(
      importLibraryJobProgress([
        { id: '1', path: '/a', status: 'succeeded' },
        { id: '2', path: '/b', status: 'pending' },
      ]),
    ).toBe(50)
  })
})
