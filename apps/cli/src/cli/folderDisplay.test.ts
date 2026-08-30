import { describe, expect, it } from 'vitest'
import { Path } from '@smm/utils/path'
import type { MediaMetadata } from '@smm/types'
import {
  formatMediaFilesTree,
  formatShowFolder,
  relativeMediaFilePath,
  toShowFolderApiResult,
} from './folderDisplay'

describe('relativeMediaFilePath', () => {
  it('keeps already-relative paths and normalizes separators', () => {
    const rel = relativeMediaFilePath('/media/Show', 'Season 01/S01E01.mp4')
    expect(rel).toBe(Path.isWindows() ? 'Season 01\\S01E01.mp4' : 'Season 01/S01E01.mp4')
  })

  it('strips the media folder prefix from absolute paths', () => {
    const rel = relativeMediaFilePath('/media/Show', '/media/Show/Season 01/S01E01.mp4')
    expect(rel).toBe(Path.isWindows() ? 'Season 01\\S01E01.mp4' : 'Season 01/S01E01.mp4')
  })
})

describe('formatMediaFilesTree', () => {
  it('prints only matched TV episodes grouped by season', () => {
    const mm: MediaMetadata = {
      mediaFolderPath: '/media/Kill Me Baby',
      type: 'tvshow-folder',
      tvShow: {
        database: 'TMDB',
        id: '1',
        name: 'Kill Me Baby',
        seasons: [
          {
            season: 0,
            name: 'Specials',
            episodes: [{ season: 0, episode: 1, name: 'OVA' }],
          },
          {
            season: 1,
            name: 'Season 1',
            episodes: [
              { season: 1, episode: 1, name: 'Pilot' },
              { season: 1, episode: 2, name: 'Second' },
              { season: 1, episode: 3, name: 'Unmatched' },
            ],
          },
        ],
      },
      mediaFiles: [
        {
          absolutePath: '/media/Kill Me Baby/Season 01/S01E02.mp4',
          seasonNumber: 1,
          episodeNumber: 2,
        },
        {
          absolutePath: 'Season 00/S00E01.mp4',
          seasonNumber: 0,
          episodeNumber: 1,
        },
        {
          absolutePath: '/media/Kill Me Baby/Season 01/S01E01.mp4',
          seasonNumber: 1,
          episodeNumber: 1,
        },
        {
          absolutePath: '/media/Kill Me Baby/orphan.mp4',
        },
      ],
    }

    const lines = formatMediaFilesTree(mm)
    const sep = Path.isWindows() ? '\\' : '/'
    expect(lines).toEqual([
      'Season 0: Specials',
      '    S00E01 OVA',
      `           Season 00${sep}S00E01.mp4`,
      'Season 1: Season 1',
      '    S01E01 Pilot',
      `           Season 01${sep}S01E01.mp4`,
      '    S01E02 Second',
      `           Season 01${sep}S01E02.mp4`,
    ])
    expect(lines.join('\n')).not.toContain('Unmatched')
    expect(lines.join('\n')).not.toContain('orphan')
  })

  it('prints movie media files as relative paths', () => {
    const mm: MediaMetadata = {
      mediaFolderPath: '/media/Dark Knight',
      type: 'movie-folder',
      movie: { database: 'TMDB', id: '1', name: 'The Dark Knight' },
      mediaFiles: [{ absolutePath: '/media/Dark Knight/movie.mkv' }],
    }
    expect(formatMediaFilesTree(mm)).toEqual(['    movie.mkv'])
  })

  it('returns empty for music folders', () => {
    const mm: MediaMetadata = {
      type: 'music-folder',
      mediaFiles: [{ absolutePath: 'track.mp3' }],
    }
    expect(formatMediaFilesTree(mm)).toEqual([])
  })
})

describe('formatShowFolder', () => {
  it('appends the mediaFiles tree after the summary when metadata is present', () => {
    const lines = formatShowFolder({
      path: 'C:\\media\\Show',
      status: 'ok',
      type: 'tvshow-folder',
      title: 'Demo',
      metadata: {
        mediaFolderPath: '/media/Show',
        type: 'tvshow-folder',
        tvShow: {
          database: 'TMDB',
          id: '1',
          name: 'Demo',
          seasons: [
            {
              season: 1,
              name: 'Season 1',
              episodes: [{ season: 1, episode: 1, name: 'Pilot' }],
            },
          ],
        },
        mediaFiles: [
          { absolutePath: 'S01E01.mkv', seasonNumber: 1, episodeNumber: 1 },
        ],
      },
    })
    expect(lines[0]).toBe('Path:    C:\\media\\Show')
    expect(lines).toContain('Title:   Demo')
    expect(lines).toContain('')
    expect(lines).toContain('Season 1: Season 1')
    expect(lines).toContain('    S01E01 Pilot')
  })

  it('omits the tree when status is not ok or metadata is absent', () => {
    expect(
      formatShowFolder({ path: '/x', status: 'folder_not_found' }).join('\n'),
    ).not.toContain('Season')
    expect(
      formatShowFolder({
        path: '/x',
        status: 'ok',
        type: 'tvshow-folder',
        title: 'Demo',
      }).join('\n'),
    ).not.toContain('Season')
  })
})

describe('toShowFolderApiResult', () => {
  it('strips metadata from the HTTP payload', () => {
    expect(
      toShowFolderApiResult({
        path: '/media/Show',
        status: 'ok',
        type: 'tvshow-folder',
        title: 'Demo',
        metadata: { type: 'tvshow-folder', mediaFiles: [] },
      }),
    ).toEqual({
      path: '/media/Show',
      status: 'ok',
      type: 'tvshow-folder',
      title: 'Demo',
    })
  })
})
