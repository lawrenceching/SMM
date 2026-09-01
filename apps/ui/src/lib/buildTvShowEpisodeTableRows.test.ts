import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  buildTvShowEpisodeTableRows,
  buildTvShowEpisodeTableRowsForPlan,
  fillTvShowEpisodeTableRowByRecognizeMediaFilesPlan,
  fillTvShowEpisodeTableRowByRenameFilesPlan,
} from './buildTvShowEpisodeTableRows'
import type {
  UIMediaFileTableRow,
  UIMediaFileDataRow,
  UIMediaEpisodeSelection,
} from '@/components/media/UIMediaFileTable'
import type { UIRecognizeMediaFilePlan } from '@/types/UIRecognizeMediaFilePlan'
import type { UIRenameFilesPlan } from '@/types/UIRenameFilesPlan'
import type { MediaMetadata } from '@smm/types'

function episodeRow(season: number, episode: number, videoFile?: string): UIMediaFileDataRow {
  return {
    season,
    episode,
    type: 'episode',
    videoFile,
    thumbnail: undefined,
    subtitle: undefined,
    nfo: undefined,
    episodeTitle: '',
  }
}

/** Set of "s-e" keys for a defaultChecked list, for easy membership asserts. */
function selectedKeys(defaultChecked: UIMediaEpisodeSelection[]): Set<string> {
  return new Set(defaultChecked.map((e) => `${e.season}-${e.episode}`))
}

function recognizePlan(files: { season: number; episode: number; path: string }[]): UIRecognizeMediaFilePlan {
  return {
    id: 'plan-1',
    task: 'recognize-media-file',
    status: 'completed',
    mediaFolderPath: '/media/show',
    files: files.map((f) => ({ season: f.season, episode: f.episode, path: f.path })),
    tmp: false,
  }
}

function renamePlan(files: { from: string; to: string }[]): UIRenameFilesPlan {
  return {
    id: 'rename-plan-1',
    task: 'rename-files',
    status: 'completed',
    mediaFolderPath: '/media/show',
    files,
    tmp: false,
  }
}

/** Matches `TvShowMediaMetadata` shape used by `buildTvShowEpisodeTableRows` (`mm.tvShow`). */
function tvShowForPlanTests() {
  return {
    id: '1',
    name: 'Test Show',
    database: 'TMDB' as const,
    airDate: '2024-01-01',
    seasons: [
      {
        season: 1,
        name: 'Season 1',
        episodes: [{ season: 1, episode: 1, name: 'Episode 1' }],
      },
    ],
  }
}

describe('fillTvShowEpisodeTableRowByRecognizeMediaFilesPlan', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  it('fills matching episode row with video path and adds it to defaultChecked', () => {
    const rows: UIMediaFileTableRow[] = [
      episodeRow(1, 1),
      episodeRow(1, 2),
    ]
    const plan = recognizePlan([
      { season: 1, episode: 1, path: '/media/show/S01E01.mkv' },
    ])

    const { rows: result, defaultChecked } = fillTvShowEpisodeTableRowByRecognizeMediaFilesPlan(rows, plan)
    const keys = selectedKeys(defaultChecked)

    const row1 = result.find((r) => r.type === 'episode' && r.season === 1 && r.episode === 1) as UIMediaFileDataRow
    expect(row1.videoFile).toBe('/media/show/S01E01.mkv')
    expect(keys.has('1-1')).toBe(true)
    expect(row1.disabled).toBe(false)
    expect(row1.newVideoFile).toBeUndefined()

    const row2 = result.find((r) => r.type === 'episode' && r.season === 1 && r.episode === 2) as UIMediaFileDataRow
    expect(row2.videoFile).toBeUndefined()
    expect(keys.has('1-2')).toBe(false)
    expect(row2.disabled).toBe(true)
  })

  it('keeps existing videoFile but disables row when episode is not in plan', () => {
    const rows: UIMediaFileTableRow[] = [
      episodeRow(1, 1, '/media/show/existing-S01E01.mkv'),
      episodeRow(1, 2, '/media/show/existing-S01E02.mkv'),
    ]
    const plan = recognizePlan([
      { season: 1, episode: 1, path: '/media/show/S01E01.mkv' },
    ])

    const { rows: result, defaultChecked } = fillTvShowEpisodeTableRowByRecognizeMediaFilesPlan(rows, plan)
    const keys = selectedKeys(defaultChecked)

    const row1 = result.find((r) => r.type === 'episode' && r.season === 1 && r.episode === 1) as UIMediaFileDataRow
    expect(row1.videoFile).toBe('/media/show/S01E01.mkv')
    expect(keys.has('1-1')).toBe(true)
    expect(row1.disabled).toBe(false)

    const row2 = result.find((r) => r.type === 'episode' && r.season === 1 && r.episode === 2) as UIMediaFileDataRow
    expect(row2.videoFile).toBe('/media/show/existing-S01E02.mkv')
    expect(keys.has('1-2')).toBe(false)
    expect(row2.disabled).toBe(true)
  })

  it('disables row when plan path matches existing mediaFiles path', () => {
    const rows: UIMediaFileTableRow[] = [
      episodeRow(1, 1, '/media/show/S01E01.mkv'),
      episodeRow(1, 2, '/media/show/S01E02.mkv'),
    ]
    const plan = recognizePlan([
      { season: 1, episode: 1, path: '/media/show/S01E01.mkv' },
      { season: 1, episode: 2, path: '/media/show/S01E02.mkv' },
    ])

    const { rows: result, defaultChecked } = fillTvShowEpisodeTableRowByRecognizeMediaFilesPlan(rows, plan)

    expect(defaultChecked).toEqual([])

    const row1 = result.find((r) => r.type === 'episode' && r.season === 1 && r.episode === 1) as UIMediaFileDataRow
    expect(row1.videoFile).toBe('/media/show/S01E01.mkv')
    expect(row1.disabled).toBe(true)

    const row2 = result.find((r) => r.type === 'episode' && r.season === 1 && r.episode === 2) as UIMediaFileDataRow
    expect(row2.videoFile).toBe('/media/show/S01E02.mkv')
    expect(row2.disabled).toBe(true)
  })

  it('enables row when plan path differs from existing mediaFiles path', () => {
    const rows: UIMediaFileTableRow[] = [
      episodeRow(1, 1, '/media/show/old-S01E01.mkv'),
    ]
    const plan = recognizePlan([
      { season: 1, episode: 1, path: '/media/show/S01E01.mkv' },
    ])

    const { rows: result, defaultChecked } = fillTvShowEpisodeTableRowByRecognizeMediaFilesPlan(rows, plan)

    const row = result[0] as UIMediaFileDataRow
    expect(row.videoFile).toBe('/media/show/S01E01.mkv')
    expect(selectedKeys(defaultChecked).has('1-1')).toBe(true)
    expect(row.disabled).toBe(false)
  })

  it('clears newVideoFile when filling from plan', () => {
    const rows: UIMediaFileTableRow[] = [
      episodeRow(1, 1, '/media/show/old.mkv'),
    ]
    ;(rows[0] as UIMediaFileDataRow).newVideoFile = '/media/show/new.mkv'
    const plan = recognizePlan([{ season: 1, episode: 1, path: '/media/show/S01E01.mkv' }])

    const { rows: result, defaultChecked } = fillTvShowEpisodeTableRowByRecognizeMediaFilesPlan(rows, plan)

    const row = result[0] as UIMediaFileDataRow
    expect(row.videoFile).toBe('/media/show/S01E01.mkv')
    expect(row.newVideoFile).toBeUndefined()
    expect(selectedKeys(defaultChecked).has('1-1')).toBe(true)
    expect(row.disabled).toBe(false)
  })

  it('does not mutate input rows', () => {
    const rows: UIMediaFileTableRow[] = [episodeRow(1, 1)]
    const plan = recognizePlan([{ season: 1, episode: 1, path: '/media/show/S01E01.mkv' }])

    fillTvShowEpisodeTableRowByRecognizeMediaFilesPlan(rows, plan)

    expect((rows[0] as UIMediaFileDataRow).videoFile).toBeUndefined()
    expect((rows[0] as UIMediaFileDataRow).newVideoFile).toBeUndefined()
  })

  it('handles multiple recognized files in one plan', () => {
    const rows: UIMediaFileTableRow[] = [
      episodeRow(1, 1),
      episodeRow(1, 2),
      episodeRow(2, 1),
    ]
    const plan = recognizePlan([
      { season: 1, episode: 1, path: '/media/show/S01E01.mkv' },
      { season: 1, episode: 2, path: '/media/show/S01E02.mkv' },
      { season: 2, episode: 1, path: '/media/show/S02E01.mkv' },
    ])

    const { rows: result, defaultChecked } = fillTvShowEpisodeTableRowByRecognizeMediaFilesPlan(rows, plan)
    const keys = selectedKeys(defaultChecked)

    expect((result[0] as UIMediaFileDataRow).videoFile).toBe('/media/show/S01E01.mkv')
    expect(keys.has('1-1')).toBe(true)
    expect((result[0] as UIMediaFileDataRow).disabled).toBe(false)
    expect((result[1] as UIMediaFileDataRow).videoFile).toBe('/media/show/S01E02.mkv')
    expect(keys.has('1-2')).toBe(true)
    expect((result[1] as UIMediaFileDataRow).disabled).toBe(false)
    expect((result[2] as UIMediaFileDataRow).videoFile).toBe('/media/show/S02E01.mkv')
    expect(keys.has('2-1')).toBe(true)
    expect((result[2] as UIMediaFileDataRow).disabled).toBe(false)
  })

  it('skips recognized files that do not match any row and warns', () => {
    const rows: UIMediaFileTableRow[] = [episodeRow(1, 1)]
    const plan = recognizePlan([
      { season: 1, episode: 1, path: '/media/show/S01E01.mkv' },
      { season: 5, episode: 99, path: '/media/show/unknown.mkv' },
    ])

    const { rows: result, defaultChecked } = fillTvShowEpisodeTableRowByRecognizeMediaFilesPlan(rows, plan)

    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining('season 5 episode 99'),
    )
    expect((result[0] as UIMediaFileDataRow).videoFile).toBe('/media/show/S01E01.mkv')
    expect(selectedKeys(defaultChecked).has('1-1')).toBe(true)
  })

  it('ignores non-episode rows (dividers, folder files)', () => {
    const rows: UIMediaFileTableRow[] = [
      { id: 'season-1', type: 'divider', text: 'Season 1' },
      episodeRow(1, 1),
      { id: 'poster', type: 'folderFile', path: '/media/show/poster.jpg' },
    ]
    const plan = recognizePlan([{ season: 1, episode: 1, path: '/media/show/S01E01.mkv' }])

    const { rows: result } = fillTvShowEpisodeTableRowByRecognizeMediaFilesPlan(rows, plan)

    expect(result).toHaveLength(3)
    expect(result[0]).toEqual({ id: 'season-1', type: 'divider', text: 'Season 1' })
    expect((result[1] as UIMediaFileDataRow).videoFile).toBe('/media/show/S01E01.mkv')
    expect(result[2]).toEqual({ id: 'poster', type: 'folderFile', path: '/media/show/poster.jpg' })
  })

  it('returns unchanged clone when plan has no files', () => {
    const rows: UIMediaFileTableRow[] = [episodeRow(1, 1)]
    const plan = recognizePlan([])

    const { rows: result, defaultChecked } = fillTvShowEpisodeTableRowByRecognizeMediaFilesPlan(rows, plan)

    expect(result).toHaveLength(1)
    expect((result[0] as UIMediaFileDataRow).videoFile).toBeUndefined()
    expect(defaultChecked).toEqual([])
    expect((result[0] as UIMediaFileDataRow).disabled).toBe(true)
  })

  it('sets disabled true for episodes not in plan when plan has no files', () => {
    const rows: UIMediaFileTableRow[] = [
      episodeRow(1, 1, '/media/show/existing.mkv'),
    ]
    const plan = recognizePlan([])

    const { rows: result, defaultChecked } = fillTvShowEpisodeTableRowByRecognizeMediaFilesPlan(rows, plan)

    const row = result[0] as UIMediaFileDataRow
    expect(row.videoFile).toBe('/media/show/existing.mkv')
    expect(defaultChecked).toEqual([])
    expect(row.disabled).toBe(true)
  })

  it('leaves row enabled and unselected when recognized file path is undefined', () => {
    const rows: UIMediaFileTableRow[] = [episodeRow(1, 1)]
    const plan = recognizePlan([{ season: 1, episode: 1, path: undefined! }]) as UIRecognizeMediaFilePlan

    const { rows: result, defaultChecked } = fillTvShowEpisodeTableRowByRecognizeMediaFilesPlan(rows, plan)

    const row = result[0] as UIMediaFileDataRow
    expect(row.videoFile).toBeUndefined()
    expect(defaultChecked).toEqual([])
    expect(row.disabled).toBe(false)
  })
})

describe('fillTvShowEpisodeTableRowByRenameFilesPlan', () => {
  it('sets newVideoFile and adds to defaultChecked when rename from matches episode videoFile', () => {
    const rows: UIMediaFileTableRow[] = [
      episodeRow(1, 1, '/media/show/S01E01.mkv'),
      episodeRow(1, 2, '/media/show/S01E02.mkv'),
    ]
    const plan = renamePlan([
      { from: '/media/show/S01E01.mkv', to: '/media/show/Season 01/Episode 01.mkv' },
    ])

    const { rows: result, defaultChecked } = fillTvShowEpisodeTableRowByRenameFilesPlan(rows, plan)
    const keys = selectedKeys(defaultChecked)

    expect((result[0] as UIMediaFileDataRow).newVideoFile).toBe('/media/show/Season 01/Episode 01.mkv')
    expect(keys.has('1-1')).toBe(true)
    expect((result[0] as UIMediaFileDataRow).disabled).toBe(false)
    expect((result[1] as UIMediaFileDataRow).newVideoFile).toBeUndefined()
    expect(keys.has('1-2')).toBe(false)
    expect((result[1] as UIMediaFileDataRow).disabled).toBe(true)
  })

  it('applies multiple rename mappings to multiple episode rows', () => {
    const rows: UIMediaFileTableRow[] = [
      episodeRow(1, 1, '/media/show/S01E01.mkv'),
      episodeRow(1, 2, '/media/show/S01E02.mkv'),
      episodeRow(2, 1, '/media/show/S02E01.mkv'),
    ]
    const plan = renamePlan([
      { from: '/media/show/S01E01.mkv', to: '/media/show/new/S01E01.mkv' },
      { from: '/media/show/S02E01.mkv', to: '/media/show/new/S02E01.mkv' },
    ])

    const { rows: result, defaultChecked } = fillTvShowEpisodeTableRowByRenameFilesPlan(rows, plan)
    const keys = selectedKeys(defaultChecked)

    expect((result[0] as UIMediaFileDataRow).newVideoFile).toBe('/media/show/new/S01E01.mkv')
    expect(keys.has('1-1')).toBe(true)
    expect((result[0] as UIMediaFileDataRow).disabled).toBe(false)
    expect((result[1] as UIMediaFileDataRow).newVideoFile).toBeUndefined()
    expect(keys.has('1-2')).toBe(false)
    expect((result[1] as UIMediaFileDataRow).disabled).toBe(true)
    expect((result[2] as UIMediaFileDataRow).newVideoFile).toBe('/media/show/new/S02E01.mkv')
    expect(keys.has('2-1')).toBe(true)
    expect((result[2] as UIMediaFileDataRow).disabled).toBe(false)
  })

  it('keeps rows unchanged when no rename from path matches', () => {
    const rows: UIMediaFileTableRow[] = [
      episodeRow(1, 1, '/media/show/S01E01.mkv'),
      episodeRow(1, 2, '/media/show/S01E02.mkv'),
    ]
    const plan = renamePlan([
      { from: '/media/show/UNKNOWN.mkv', to: '/media/show/new/UNKNOWN.mkv' },
    ])

    const { rows: result, defaultChecked } = fillTvShowEpisodeTableRowByRenameFilesPlan(rows, plan)

    expect((result[0] as UIMediaFileDataRow).newVideoFile).toBeUndefined()
    expect(defaultChecked).toEqual([])
    expect((result[0] as UIMediaFileDataRow).disabled).toBe(true)
    expect((result[1] as UIMediaFileDataRow).newVideoFile).toBeUndefined()
    expect((result[1] as UIMediaFileDataRow).disabled).toBe(true)
  })

  it('ignores non-episode rows', () => {
    const rows: UIMediaFileTableRow[] = [
      { id: 'season-1', type: 'divider', text: 'Season 1' },
      episodeRow(1, 1, '/media/show/S01E01.mkv'),
      { id: 'fanart', type: 'folderFile', path: '/media/show/fanart.jpg' },
    ]
    const plan = renamePlan([
      { from: '/media/show/S01E01.mkv', to: '/media/show/new/S01E01.mkv' },
    ])

    const { rows: result, defaultChecked } = fillTvShowEpisodeTableRowByRenameFilesPlan(rows, plan)

    expect(result[0]).toEqual({ id: 'season-1', type: 'divider', text: 'Season 1' })
    expect((result[1] as UIMediaFileDataRow).newVideoFile).toBe('/media/show/new/S01E01.mkv')
    expect(selectedKeys(defaultChecked).has('1-1')).toBe(true)
    expect(result[2]).toEqual({ id: 'fanart', type: 'folderFile', path: '/media/show/fanart.jpg' })
  })

  it('does not mutate input rows', () => {
    const rows: UIMediaFileTableRow[] = [
      episodeRow(1, 1, '/media/show/S01E01.mkv'),
    ]
    const plan = renamePlan([
      { from: '/media/show/S01E01.mkv', to: '/media/show/new/S01E01.mkv' },
    ])

    fillTvShowEpisodeTableRowByRenameFilesPlan(rows, plan)

    expect((rows[0] as UIMediaFileDataRow).newVideoFile).toBeUndefined()
  })
})

describe('buildTvShowEpisodeTableRows', () => {
  it('returns initializing divider row when uiStatus is initializing', () => {
    const mm = {} as MediaMetadata

    const rows = buildTvShowEpisodeTableRows(mm, 'initializing', (key) => key)

    expect(rows).toEqual([
      {
        id: 'initializing',
        type: 'divider',
        text: 'mediaFolder.initializing',
      },
    ])
  })

  it('returns folder_not_found divider row when uiStatus is folder_not_found', () => {
    const mm = {} as MediaMetadata

    const rows = buildTvShowEpisodeTableRows(mm, 'folder_not_found', (key) => key)

    expect(rows).toEqual([
      {
        id: 'folder_not_found',
        type: 'divider',
        text: 'mediaFolder.folderNotFound',
      },
    ])
  })

  it('returns error_loading_metadata divider row when uiStatus is error_loading_metadata', () => {
    const mm = {} as MediaMetadata

    const rows = buildTvShowEpisodeTableRows(mm, 'error_loading_metadata', (key) => key)

    expect(rows).toEqual([
      {
        id: 'error_loading_metadata',
        type: 'divider',
        text: 'mediaFolder.errorLoadingMetadata',
      },
    ])
  })

  it('bulid rows for fanart, poster, theme, nfo files', () => {
    const mm = {
      mediaFolderPath: '/media/show',
      files: [
        '/media/show/fanart.jpg',
        '/media/show/poster.png',
        '/media/show/theme.mp3',
        '/media/show/tvshow.nfo',
      ],
    } as MediaMetadata

    const rows = buildTvShowEpisodeTableRows(mm, 'ok', (key) => key, mm.files ?? [])
    const folderRows = rows.filter((row) => row.type === 'folderFile')

    expect(folderRows).toEqual([
      { id: 'fanart', type: 'folderFile', path: '/media/show/fanart.jpg' },
      { id: 'poster', type: 'folderFile', path: '/media/show/poster.png' },
      { id: 'theme', type: 'folderFile', path: '/media/show/theme.mp3' },
      { id: 'nfo', type: 'folderFile', path: '/media/show/tvshow.nfo' },
    ])
  })
})

describe('buildTvShowEpisodeTableRows with tmdb/tvdb branches', () => {
  it('shows the episode video from mediaFiles when live folder files are missing', () => {
    const mm = {
      mediaFolderPath: '/media/show',
      mediaFiles: [
        {
          absolutePath: '/media/show/S01E01.mkv',
          seasonNumber: 1,
          episodeNumber: 1,
        },
      ],
      tvShow: tvShowForPlanTests(),
    } as MediaMetadata

    const rows = buildTvShowEpisodeTableRows(mm, 'ok', (key) => key, mm.files ?? [])
    const ep = rows.find((row) => row.type === 'episode' && row.season === 1 && row.episode === 1) as UIMediaFileDataRow

    expect(ep.videoFile).toBe('/media/show/S01E01.mkv')
  })

  it('includes fanart row when tmdbTvShow branch is used', () => {
    const mm = {
      mediaFolderPath: '/media/show',
      files: ['/media/show/fanart.jpg'],
      tmdbTvShow: {
        id: 1,
        name: 'Test Show',
        original_name: 'Test Show',
        overview: '',
        poster_path: null,
        backdrop_path: null,
        first_air_date: '2024-01-01',
        vote_average: 0,
        vote_count: 0,
        popularity: 0,
        genre_ids: [],
        origin_country: [],
        number_of_seasons: 0,
        number_of_episodes: 0,
        seasons: [],
        status: 'Ended',
        type: 'Scripted',
        in_production: false,
        last_air_date: '2024-01-01',
        networks: [],
        production_companies: [],
      },
    } as MediaMetadata

    const rows = buildTvShowEpisodeTableRows(mm, 'ok', (key) => key, mm.files ?? [])

    expect(rows).toContainEqual({
      id: 'fanart',
      type: 'folderFile',
      path: '/media/show/fanart.jpg',
    })
  })

  it('includes fanart row when tvdbTvShow branch is used', () => {
    const mm = {
      mediaFolderPath: '/media/show',
      files: ['/media/show/fanart.jpg'],
      tvdbTvShow: {
        id: '1',
        name: 'Test Show',
        database: 'TVDB',
        seasons: [],
      },
    } as MediaMetadata

    const rows = buildTvShowEpisodeTableRows(mm, 'ok', (key) => key, mm.files ?? [])

    expect(rows).toContainEqual({
      id: 'fanart',
      type: 'folderFile',
      path: '/media/show/fanart.jpg',
    })
  })
})

describe('buildTvShowEpisodeTableRowsForPlan', () => {
  it('returns initializing divider when uiStatus is initializing', () => {
    const mm = {} as MediaMetadata
    const plan = recognizePlan([{ season: 1, episode: 1, path: '/media/show/S01E01.mkv' }])

    const { rows, defaultChecked } = buildTvShowEpisodeTableRowsForPlan(mm, 'initializing', plan, (key) => key)

    expect(rows).toEqual([
      {
        id: 'initializing',
        type: 'divider',
        text: 'mediaFolder.initializing',
      },
    ])
    expect(defaultChecked).toEqual([])
  })

  it('returns folder_not_found divider when uiStatus is folder_not_found', () => {
    const mm = {} as MediaMetadata
    const plan = recognizePlan([{ season: 1, episode: 1, path: '/media/show/S01E01.mkv' }])

    const { rows, defaultChecked } = buildTvShowEpisodeTableRowsForPlan(mm, 'folder_not_found', plan, (key) => key)

    expect(rows).toEqual([
      {
        id: 'folder_not_found',
        type: 'divider',
        text: 'mediaFolder.folderNotFound',
      },
    ])
    expect(defaultChecked).toEqual([])
  })

  it('returns error_loading_metadata divider when uiStatus is error_loading_metadata', () => {
    const mm = {} as MediaMetadata
    const plan = recognizePlan([{ season: 1, episode: 1, path: '/media/show/S01E01.mkv' }])

    const { rows, defaultChecked } = buildTvShowEpisodeTableRowsForPlan(mm, 'error_loading_metadata', plan, (key) => key)

    expect(rows).toEqual([
      {
        id: 'error_loading_metadata',
        type: 'divider',
        text: 'mediaFolder.errorLoadingMetadata',
      },
    ])
    expect(defaultChecked).toEqual([])
  })

  it('returns base rows unchanged and no default selection when recognize plan is preparing', () => {
    const mm = {
      tvShow: tvShowForPlanTests(),
    } as MediaMetadata
    const plan = {
      ...recognizePlan([{ season: 1, episode: 1, path: '/media/show/S01E01.mkv' }]),
      status: 'preparing',
    } as UIRecognizeMediaFilePlan

    const { rows, defaultChecked } = buildTvShowEpisodeTableRowsForPlan(mm, 'ok', plan, (key) => key)
    const ep = rows.find((row) => row.type === 'episode' && row.season === 1 && row.episode === 1) as UIMediaFileDataRow

    expect(ep.videoFile).toBeUndefined()
    expect(defaultChecked).toEqual([])
  })

  it('fills episode row from recognize plan when recognize plan is completed', () => {
    const mm = {
      tvShow: tvShowForPlanTests(),
    } as MediaMetadata
    const plan = recognizePlan([{ season: 1, episode: 1, path: '/media/show/S01E01.mkv' }])

    const { rows, defaultChecked } = buildTvShowEpisodeTableRowsForPlan(mm, 'ok', plan, (key) => key)
    const ep = rows.find((row) => row.type === 'episode' && row.season === 1 && row.episode === 1) as UIMediaFileDataRow

    expect(ep.videoFile).toBe('/media/show/S01E01.mkv')
    expect(selectedKeys(defaultChecked).has('1-1')).toBe(true)
    expect(ep.newVideoFile).toBeUndefined()
  })

  it('fills newVideoFile from rename plan when rename plan is completed', () => {
    const mm = {
      mediaFolderPath: '/media/show',
      files: ['/media/show/S01E01.mkv'],
      mediaFiles: [
        {
          absolutePath: '/media/show/S01E01.mkv',
          seasonNumber: 1,
          episodeNumber: 1,
        },
      ],
      tvShow: tvShowForPlanTests(),
    } as MediaMetadata
    const plan = renamePlan([
      { from: '/media/show/S01E01.mkv', to: '/media/show/new/S01E01.mkv' },
    ])

    const { rows, defaultChecked } = buildTvShowEpisodeTableRowsForPlan(mm, 'ok', plan, (key) => key)
    const ep = rows.find((row) => row.type === 'episode' && row.season === 1 && row.episode === 1) as UIMediaFileDataRow

    expect(ep.videoFile).toBe('/media/show/S01E01.mkv')
    expect(ep.newVideoFile).toBe('/media/show/new/S01E01.mkv')
    expect(selectedKeys(defaultChecked).has('1-1')).toBe(true)
  })
})
