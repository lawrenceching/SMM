import { describe, expect, it } from 'vitest'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  classifyRenameTarget,
  findLongestManagedFolder,
  isExactManagedFolder,
} from './renameDispatch'

describe('renameDispatch', () => {
  it('isExactManagedFolder matches POSIX and platform paths', () => {
    const folders = ['/media/TV/Show']
    expect(isExactManagedFolder('/media/TV/Show', folders)).toBe(true)
    expect(isExactManagedFolder('/media/TV/Show/', folders)).toBe(true)
    expect(isExactManagedFolder('/media/TV/Show/S01E01.mkv', folders)).toBe(false)
  })

  it('findLongestManagedFolder prefers the deepest managed folder', () => {
    const folders = ['/media/TV', '/media/TV/Show']
    expect(findLongestManagedFolder('/media/TV/Show/S01E01.mkv', folders)).toBe(
      '/media/TV/Show',
    )
    expect(findLongestManagedFolder('/media/TV/Other/x.mkv', folders)).toBe('/media/TV')
    expect(findLongestManagedFolder('/elsewhere/x.mkv', folders)).toBeNull()
  })

  it('classifyRenameTarget returns folder for managed root', async () => {
    const classified = await classifyRenameTarget('/media/TV/Show', ['/media/TV/Show'])
    expect(classified).toEqual({ kind: 'folder' })
  })

  it('classifyRenameTarget returns episode for a file under a managed folder', async () => {
    const root = mkdtempSync(join(tmpdir(), 'smm-rename-dispatch-'))
    try {
      const media = join(root, 'Show')
      mkdirSync(media)
      const episode = join(media, 'S01E01.mkv')
      writeFileSync(episode, 'x')
      const classified = await classifyRenameTarget(episode, [media])
      expect(classified).toEqual({ kind: 'episode', mediaFolderPath: media })
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('classifyRenameTarget rejects a non-root directory under a managed folder', async () => {
    const root = mkdtempSync(join(tmpdir(), 'smm-rename-dispatch-'))
    try {
      const media = join(root, 'Show')
      const season = join(media, 'Season 01')
      mkdirSync(season, { recursive: true })
      await expect(classifyRenameTarget(season, [media])).rejects.toThrow(
        /directory but not a managed media folder/,
      )
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('classifyRenameTarget rejects unmanaged paths', async () => {
    await expect(
      classifyRenameTarget('/not/managed/file.mkv', ['/media/TV/Show']),
    ).rejects.toThrow(/not under a managed media folder/)
  })
})
