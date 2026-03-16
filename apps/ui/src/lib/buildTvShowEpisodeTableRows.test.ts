import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  fillTvShowEpisodeTableRowByRecognizeMediaFilesPlan,
} from './buildTvShowEpisodeTableRows'
import type { TvShowEpisodeTableRow, TvShowEpisodeDataRow } from '@/components/TvShowEpisodeTable'
import type { UIRecognizeMediaFilePlan } from '@/types/UIRecognizeMediaFilePlan'

function episodeRow(season: number, episode: number, videoFile?: string, checked = false): TvShowEpisodeDataRow {
  return {
    season,
    episode,
    type: 'episode',
    videoFile,
    thumbnail: undefined,
    subtitle: undefined,
    nfo: undefined,
    episodeTitle: '',
    checked,
  }
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

describe('fillTvShowEpisodeTableRowByRecognizeMediaFilesPlan', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  it('fills matching episode row with video path and sets checked true', () => {
    const rows: TvShowEpisodeTableRow[] = [
      episodeRow(1, 1, undefined, false),
      episodeRow(1, 2, undefined, false),
    ]
    const plan = recognizePlan([
      { season: 1, episode: 1, path: '/media/show/S01E01.mkv' },
    ])

    const result = fillTvShowEpisodeTableRowByRecognizeMediaFilesPlan(rows, plan)

    const row1 = result.find((r) => r.type === 'episode' && r.season === 1 && r.episode === 1) as TvShowEpisodeDataRow
    expect(row1.videoFile).toBe('/media/show/S01E01.mkv')
    expect(row1.checked).toBe(true)
    expect(row1.newVideoFile).toBeUndefined()

    const row2 = result.find((r) => r.type === 'episode' && r.season === 1 && r.episode === 2) as TvShowEpisodeDataRow
    expect(row2.videoFile).toBeUndefined()
    expect(row2.checked).toBe(false)
  })

  it('clears newVideoFile when filling from plan', () => {
    const rows: TvShowEpisodeTableRow[] = [
      episodeRow(1, 1, '/media/show/old.mkv', true),
    ]
    ;(rows[0] as TvShowEpisodeDataRow).newVideoFile = '/media/show/new.mkv'
    const plan = recognizePlan([{ season: 1, episode: 1, path: '/media/show/S01E01.mkv' }])

    const result = fillTvShowEpisodeTableRowByRecognizeMediaFilesPlan(rows, plan)

    const row = result[0] as TvShowEpisodeDataRow
    expect(row.videoFile).toBe('/media/show/S01E01.mkv')
    expect(row.newVideoFile).toBeUndefined()
    expect(row.checked).toBe(true)
  })

  it('does not mutate input rows', () => {
    const rows: TvShowEpisodeTableRow[] = [episodeRow(1, 1, undefined, false)]
    const plan = recognizePlan([{ season: 1, episode: 1, path: '/media/show/S01E01.mkv' }])

    fillTvShowEpisodeTableRowByRecognizeMediaFilesPlan(rows, plan)

    expect((rows[0] as TvShowEpisodeDataRow).videoFile).toBeUndefined()
    expect((rows[0] as TvShowEpisodeDataRow).checked).toBe(false)
  })

  it('handles multiple recognized files in one plan', () => {
    const rows: TvShowEpisodeTableRow[] = [
      episodeRow(1, 1, undefined, false),
      episodeRow(1, 2, undefined, false),
      episodeRow(2, 1, undefined, false),
    ]
    const plan = recognizePlan([
      { season: 1, episode: 1, path: '/media/show/S01E01.mkv' },
      { season: 1, episode: 2, path: '/media/show/S01E02.mkv' },
      { season: 2, episode: 1, path: '/media/show/S02E01.mkv' },
    ])

    const result = fillTvShowEpisodeTableRowByRecognizeMediaFilesPlan(rows, plan)

    expect((result[0] as TvShowEpisodeDataRow).videoFile).toBe('/media/show/S01E01.mkv')
    expect((result[0] as TvShowEpisodeDataRow).checked).toBe(true)
    expect((result[1] as TvShowEpisodeDataRow).videoFile).toBe('/media/show/S01E02.mkv')
    expect((result[1] as TvShowEpisodeDataRow).checked).toBe(true)
    expect((result[2] as TvShowEpisodeDataRow).videoFile).toBe('/media/show/S02E01.mkv')
    expect((result[2] as TvShowEpisodeDataRow).checked).toBe(true)
  })

  it('skips recognized files that do not match any row and warns', () => {
    const rows: TvShowEpisodeTableRow[] = [episodeRow(1, 1, undefined, false)]
    const plan = recognizePlan([
      { season: 1, episode: 1, path: '/media/show/S01E01.mkv' },
      { season: 5, episode: 99, path: '/media/show/unknown.mkv' },
    ])

    const result = fillTvShowEpisodeTableRowByRecognizeMediaFilesPlan(rows, plan)

    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining('season 5 episode 99'),
    )
    expect((result[0] as TvShowEpisodeDataRow).videoFile).toBe('/media/show/S01E01.mkv')
  })

  it('ignores non-episode rows (dividers, folder files)', () => {
    const rows: TvShowEpisodeTableRow[] = [
      { id: 'season-1', type: 'divider', text: 'Season 1' },
      episodeRow(1, 1, undefined, false),
      { id: 'poster', type: 'folderFile', path: '/media/show/poster.jpg' },
    ]
    const plan = recognizePlan([{ season: 1, episode: 1, path: '/media/show/S01E01.mkv' }])

    const result = fillTvShowEpisodeTableRowByRecognizeMediaFilesPlan(rows, plan)

    expect(result).toHaveLength(3)
    expect(result[0]).toEqual({ id: 'season-1', type: 'divider', text: 'Season 1' })
    expect((result[1] as TvShowEpisodeDataRow).videoFile).toBe('/media/show/S01E01.mkv')
    expect(result[2]).toEqual({ id: 'poster', type: 'folderFile', path: '/media/show/poster.jpg' })
  })

  it('returns unchanged clone when plan has no files', () => {
    const rows: TvShowEpisodeTableRow[] = [episodeRow(1, 1, undefined, false)]
    const plan = recognizePlan([])

    const result = fillTvShowEpisodeTableRowByRecognizeMediaFilesPlan(rows, plan)

    expect(result).toHaveLength(1)
    expect((result[0] as TvShowEpisodeDataRow).videoFile).toBeUndefined()
    expect((result[0] as TvShowEpisodeDataRow).checked).toBe(false)
  })

  it('sets checked to false when recognized file path is undefined', () => {
    const rows: TvShowEpisodeTableRow[] = [episodeRow(1, 1, undefined, false)]
    const plan = recognizePlan([{ season: 1, episode: 1, path: undefined! }]) as UIRecognizeMediaFilePlan

    const result = fillTvShowEpisodeTableRowByRecognizeMediaFilesPlan(rows, plan)

    const row = result[0] as TvShowEpisodeDataRow
    expect(row.videoFile).toBeUndefined()
    expect(row.checked).toBe(false)
  })
})
