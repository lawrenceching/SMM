import { stat } from 'fs/promises'
import { Path } from '@core/path'
import type { MediaMetadata } from '@smm/core'
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

export interface ShowFolderResult {
  path: string
  status: ShowFolderStatus
  type?: MediaMetadata['type']
  title?: string
}

function titleFromMetadata(mm: MediaMetadata): string | undefined {
  return mm.tvShow?.name ?? mm.movie?.name
}

export async function resolveShowFolder(folder: string): Promise<
  | { ok: true; result: ShowFolderResult }
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
    },
  }
}

export function formatShowFolder(result: ShowFolderResult): string[] {
  const lines = [`Path:    ${result.path}`, `Status:  ${result.status}`]
  if (result.type !== undefined) {
    lines.push(`Type:    ${result.type}`)
  }
  if (result.title !== undefined) {
    lines.push(`Title:   ${result.title}`)
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
