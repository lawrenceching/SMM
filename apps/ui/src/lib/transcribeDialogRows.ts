import type { MediaFileMetadata, MediaMetadata } from "@core/types"
import type { TranscribeDialogRow } from "@/components/dialogs/types"
import type { MusicFileRow } from "@/components/MusicFileTable"
import { basename, isAbsPath, join, relative } from "@/lib/path"
import { Path } from "@core/path"

function labelForMediaFile(
  mediaMetadata: MediaMetadata,
  mf: MediaFileMetadata
): string {
  if (mediaMetadata.type === "tvshow-folder" && mf.seasonNumber != null && mf.episodeNumber != null) {
    const s = String(mf.seasonNumber).padStart(2, "0")
    const e = String(mf.episodeNumber).padStart(2, "0")
    const season = mediaMetadata.tvShow?.seasons?.find((x) => x.season === mf.seasonNumber)
    const ep = season?.episodes?.find((x) => x.episode === mf.episodeNumber)
    const name = ep?.name?.trim()
    return name ? `S${s}E${e} ${name}` : `S${s}E${e}`
  }
  if (mediaMetadata.type === "movie-folder" && mediaMetadata.movie?.name?.trim()) {
    return mediaMetadata.movie.name.trim()
  }
  const base = basename(mf.absolutePath)
  return base ?? mf.absolutePath
}

function displayPathForFile(
  mediaFolderPath: string | undefined,
  absolutePath: string
): string | undefined {
  if (!mediaFolderPath?.trim()) return undefined
  try {
    return relative(mediaFolderPath, absolutePath)
  } catch {
    return undefined
  }
}

/**
 * Builds rows for {@link UITranscribeDialog} / {@link TranscribeDialog}.
 * `path` is always POSIX absolute (for transcribe API); `displayPath` is relative to the media folder when possible.
 */
export function transcribeDialogRowsFromMediaFiles(
  mediaMetadata: MediaMetadata | undefined,
): TranscribeDialogRow[] {
  const files = mediaMetadata?.mediaFiles
  if (!mediaMetadata || !files?.length) return []

  const folder = mediaMetadata.mediaFolderPath

  return files.map((mf) => {
    const absolutePath = Path.posix(mf.absolutePath)
    const displayPath = displayPathForFile(folder, absolutePath)
    return {
      id: absolutePath,
      path: absolutePath,
      displayPath,
      status: "pending" as const,
      title: labelForMediaFile(mediaMetadata, mf),
    }
  })
}

/**
 * Returns POSIX absolute path for a music table row, or `undefined` if not resolvable.
 */
export function absolutePosixMusicFilePath(
  row: Pick<MusicFileRow, "path">,
  mediaFolderPath?: string,
): string | undefined {
  const raw = row.path?.trim()
  if (!raw) return undefined
  if (isAbsPath(raw)) {
    return Path.posix(raw)
  }
  const folder = mediaFolderPath?.trim()
  if (!folder) return undefined
  return Path.posix(join(folder, raw))
}

/**
 * Builds rows for {@link UITranscribeDialog} / {@link TranscribeDialog} from music file table data.
 * Skips rows without a resolvable path. `id` matches POSIX absolute path.
 */
export function transcribeDialogRowsFromMusicFileRows(
  rows: MusicFileRow[],
  mediaFolderPath?: string,
): TranscribeDialogRow[] {
  const folder = mediaFolderPath?.trim() || undefined
  const out: TranscribeDialogRow[] = []
  for (const row of rows) {
    const absolutePath = absolutePosixMusicFilePath(row, folder)
    if (!absolutePath) continue
    const displayPath = displayPathForFile(folder, absolutePath)
    const title = row.title?.trim() || basename(absolutePath) || absolutePath
    out.push({
      id: absolutePath,
      path: absolutePath,
      displayPath,
      status: "pending",
      title,
    })
  }
  return out
}
