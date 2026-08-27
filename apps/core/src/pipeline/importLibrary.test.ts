import { describe, expect, it } from 'vitest'
import { dedupLibraryFolders } from './importLibrary'

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
