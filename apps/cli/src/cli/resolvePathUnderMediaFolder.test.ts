import { describe, expect, it } from 'vitest'
import { resolvePathUnderMediaFolder } from './resolvePathUnderMediaFolder'

describe('resolvePathUnderMediaFolder', () => {
  const folder = '/m/Show'

  it('keeps absolute POSIX paths', () => {
    expect(resolvePathUnderMediaFolder(folder, '/m/Show/S01E01.mp4')).toBe(
      '/m/Show/S01E01.mp4',
    )
  })

  it('joins relative paths under the folder', () => {
    expect(resolvePathUnderMediaFolder(folder, 'S01E01.mp4')).toBe(
      '/m/Show/S01E01.mp4',
    )
    expect(resolvePathUnderMediaFolder(folder, './Season 01/S01E01.mp4')).toBe(
      '/m/Show/Season 01/S01E01.mp4',
    )
  })
})
