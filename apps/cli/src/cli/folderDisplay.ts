import { stat } from 'fs/promises'
import { Path } from '@core/path'
import type { MediaFileMetadata, MediaMetadata } from '@smm/core'
import { getCore } from '../core/getCore'

function normalizePosixSafe(path: string): string {
  try {
    return Path.posix(path)
  } catch {
    return path
  }
}

async function folderExistsOnDisk(folder: string): Promise<boolean> {
  try {
    const st = await stat(Path.toPlatformPath(folder))
    return st.isDirectory()
  } catch {
    return false
  }
}

export async function isFolderImported(folder: string): Promise<boolean> {
  const folders = await getCore().getFolders()
  const target = normalizePosixSafe(folder)
  const targetPlatform = Path.toPlatformPath(folder)
  return folders.some((f) => {
    if (f === folder || f === targetPlatform) return true
    return normalizePosixSafe(f) === target
  })
}

export type ShowFolderStatus =
  | 'ok'
  | 'folder_not_found'
  | 'error_loading_metadata'

/** Public API / HTTP payload — no metadata blob. */
export interface ShowFolderResult {
  path: string
  status: ShowFolderStatus
  type?: MediaMetadata['type']
  title?: string
}

/** CLI formatting may include full metadata for mediaFiles tree. */
export interface ShowFolderCliResult extends ShowFolderResult {
  metadata?: MediaMetadata
}

export function toShowFolderApiResult(result: ShowFolderCliResult): ShowFolderResult {
  return {
    path: result.path,
    status: result.status,
    ...(result.type !== undefined ? { type: result.type } : {}),
    ...(result.title !== undefined ? { title: result.title } : {}),
  }
}

function titleFromMetadata(mm: MediaMetadata): string | undefined {
  return mm.tvShow?.name ?? mm.movie?.name
}

export async function resolveShowFolder(folder: string): Promise<
  | { ok: true; result: ShowFolderCliResult }
  | { ok: false; error: string }
> {
  if (!(await isFolderImported(folder))) {
    return { ok: false, error: `Folder is not imported: ${folder}` }
  }

  if (!(await folderExistsOnDisk(folder))) {
    return {
      ok: true,
      result: { path: folder, status: 'folder_not_found' },
    }
  }

  const mm = await getCore().getMediaMetadata(folder)
  if (mm === null) {
    return {
      ok: true,
      result: { path: folder, status: 'error_loading_metadata' },
    }
  }

  const title = titleFromMetadata(mm)
  return {
    ok: true,
    result: {
      path: folder,
      status: 'ok',
      type: mm.type,
      ...(title !== undefined ? { title } : {}),
      metadata: mm,
    },
  }
}

function looksAbsolutePath(filePath: string): boolean {
  return (
    filePath.startsWith('/') ||
    /^[A-Za-z]:[\\/]/.test(filePath) ||
    filePath.startsWith('\\\\')
  )
}

function toPlatformRelative(rel: string): string {
  const normalized = rel.replace(/^[\\/]+/, '').replace(/\\/g, '/')
  return Path.isWindows() ? normalized.split('/').join('\\') : normalized
}

/** Relative path from media folder for CLI display. */
export function relativeMediaFilePath(
  mediaFolderPath: string | undefined,
  filePath: string,
): string {
  if (!looksAbsolutePath(filePath)) {
    return toPlatformRelative(filePath)
  }
  if (mediaFolderPath === undefined || mediaFolderPath.trim() === '') {
    return Path.toPlatformPath(filePath)
  }
  try {
    const folderPosix = Path.posix(mediaFolderPath)
    const filePosix = Path.posix(filePath)
    const prefix = folderPosix.endsWith('/') ? folderPosix : `${folderPosix}/`
    if (filePosix === folderPosix) {
      return '.'
    }
    if (filePosix.startsWith(prefix)) {
      return toPlatformRelative(filePosix.slice(prefix.length))
    }
    return Path.fromAbsolutePath(filePosix, folderPosix).platformRelPath()
  } catch {
    return Path.toPlatformPath(filePath)
  }
}

function padEp(n: number): string {
  return String(n).padStart(2, '0')
}

/** Indent for episode lines (one 4-space level). */
const EPISODE_INDENT = '    '
/**
 * Path lines align under the episode title (after `    SxxExx `).
 * SxxExx is always 6 chars with zero-padded season/episode.
 */
const PATH_INDENT = `${EPISODE_INDENT}${' '.repeat(6 + 1)}`

function lookupSeasonTitle(mm: MediaMetadata, seasonNumber: number): string | undefined {
  return mm.tvShow?.seasons.find((s) => s.season === seasonNumber)?.name
}

function lookupEpisodeTitle(
  mm: MediaMetadata,
  seasonNumber: number,
  episodeNumber: number,
): string | undefined {
  const season = mm.tvShow?.seasons.find((s) => s.season === seasonNumber)
  return season?.episodes.find((e) => e.episode === episodeNumber)?.name
}

function formatTvShowMediaFiles(mm: MediaMetadata): string[] {
  const matched = (mm.mediaFiles ?? []).filter(
    (f): f is MediaFileMetadata & { seasonNumber: number; episodeNumber: number } =>
      f.seasonNumber !== undefined && f.episodeNumber !== undefined,
  )
  if (matched.length === 0) return []

  matched.sort((a, b) => {
    if (a.seasonNumber !== b.seasonNumber) return a.seasonNumber - b.seasonNumber
    if (a.episodeNumber !== b.episodeNumber) return a.episodeNumber - b.episodeNumber
    return a.absolutePath.localeCompare(b.absolutePath)
  })

  const lines: string[] = []
  let lastSeason: number | undefined
  let lastEpisodeKey: string | undefined

  for (const file of matched) {
    const { seasonNumber, episodeNumber } = file
    if (lastSeason !== seasonNumber) {
      const seasonTitle = lookupSeasonTitle(mm, seasonNumber)
      lines.push(
        seasonTitle !== undefined && seasonTitle !== ''
          ? `Season ${seasonNumber}: ${seasonTitle}`
          : `Season ${seasonNumber}:`,
      )
      lastSeason = seasonNumber
      lastEpisodeKey = undefined
    }

    const epKey = `${seasonNumber}:${episodeNumber}`
    if (lastEpisodeKey !== epKey) {
      const epTitle = lookupEpisodeTitle(mm, seasonNumber, episodeNumber)
      const code = `S${padEp(seasonNumber)}E${padEp(episodeNumber)}`
      lines.push(
        epTitle !== undefined && epTitle !== ''
          ? `${EPISODE_INDENT}${code} ${epTitle}`
          : `${EPISODE_INDENT}${code}`,
      )
      lastEpisodeKey = epKey
    }

    lines.push(
      `${PATH_INDENT}${relativeMediaFilePath(mm.mediaFolderPath, file.absolutePath)}`,
    )
  }

  return lines
}

function formatMovieMediaFiles(mm: MediaMetadata): string[] {
  const files = mm.mediaFiles ?? []
  if (files.length === 0) return []
  return files.map(
    (f) => `    ${relativeMediaFilePath(mm.mediaFolderPath, f.absolutePath)}`,
  )
}

export function formatMediaFilesTree(mm: MediaMetadata): string[] {
  if (mm.type === 'tvshow-folder') {
    return formatTvShowMediaFiles(mm)
  }
  if (mm.type === 'movie-folder') {
    return formatMovieMediaFiles(mm)
  }
  return []
}

export function formatShowFolder(result: ShowFolderCliResult): string[] {
  const lines = [`Path:    ${result.path}`, `Status:  ${result.status}`]
  if (result.type !== undefined) {
    lines.push(`Type:    ${result.type}`)
  }
  if (result.title !== undefined) {
    lines.push(`Title:   ${result.title}`)
  }
  if (result.metadata !== undefined) {
    const tree = formatMediaFilesTree(result.metadata)
    if (tree.length > 0) {
      lines.push('')
      lines.push(...tree)
    }
  }
  return lines
}

export function formatMediaMetadata(_folder: string, mm: MediaMetadata): string[] {
  const lines: string[] = []

  if (mm.mediaFolderPath !== undefined) {
    lines.push(`mediaFolderPath: ${Path.toPlatformPath(mm.mediaFolderPath)}`)
  }
  if (mm.type !== undefined) {
    lines.push(`type: ${mm.type}`)
  }

  if (mm.tvShow !== undefined) {
    const show = mm.tvShow
    lines.push('tvShow:')
    lines.push(`  name: ${show.name}`)
    lines.push(`  database: ${show.database}`)
    lines.push(`  id: ${show.id}`)
    if (show.airDate !== undefined) {
      lines.push(`  airDate: ${show.airDate}`)
    }
    lines.push(`  seasons: ${show.seasons.length}`)
    for (const season of show.seasons) {
      lines.push(`    S${String(season.season).padStart(2, '0')}  ${season.name}  (${season.episodes.length} episodes)`)
      for (const ep of season.episodes) {
        lines.push(
          `      E${String(ep.episode).padStart(2, '0')}  ${ep.name}`,
        )
      }
    }
  }

  if (mm.movie !== undefined) {
    const movie = mm.movie
    lines.push('movie:')
    lines.push(`  name: ${movie.name}`)
    lines.push(`  database: ${movie.database}`)
    lines.push(`  id: ${movie.id}`)
    if (movie.airDate !== undefined) {
      lines.push(`  airDate: ${movie.airDate}`)
    }
  }

  if (mm.mediaFiles !== undefined) {
    lines.push('mediaFiles:')
    if (mm.mediaFiles.length === 0) {
      lines.push('  (empty)')
    } else {
      for (const file of mm.mediaFiles) {
        const parts = [`absolutePath: ${Path.toPlatformPath(file.absolutePath)}`]
        if (file.seasonNumber !== undefined) {
          parts.push(`seasonNumber: ${file.seasonNumber}`)
        }
        if (file.episodeNumber !== undefined) {
          parts.push(`episodeNumber: ${file.episodeNumber}`)
        }
        lines.push(`  - ${parts.join('  ')}`)
        if (file.subtitleFilePaths !== undefined && file.subtitleFilePaths.length > 0) {
          lines.push(`    subtitleFilePaths:`)
          for (const p of file.subtitleFilePaths) {
            lines.push(`      ${Path.toPlatformPath(p)}`)
          }
        }
        if (file.audioFilePaths !== undefined && file.audioFilePaths.length > 0) {
          lines.push(`    audioFilePaths:`)
          for (const p of file.audioFilePaths) {
            lines.push(`      ${Path.toPlatformPath(p)}`)
          }
        }
      }
    }
  }

  return lines
}
