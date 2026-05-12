import type { MediaMetadata } from "@core/types"
import type { SubtitleTranslationDialogRow } from "@/components/dialogs/types"
import type { MusicFileRow } from "@/components/MusicFileTable"
import { basename, relative } from "@/lib/path"
import { Path } from "@core/path"
import { absolutePosixMusicFilePath, labelForMediaFile } from "@/lib/transcribeDialogRows"

function displayPathForFile(
  mediaFolderPath: string | undefined,
  absolutePath: string,
): string | undefined {
  if (!mediaFolderPath?.trim()) return undefined
  try {
    return relative(mediaFolderPath, absolutePath)
  } catch {
    return undefined
  }
}

function siblingSubtitlePaths(mediaPosix: string): string[] {
  const lastDot = mediaPosix.lastIndexOf(".")
  if (lastDot <= 0) return []
  const base = mediaPosix.slice(0, lastDot)
  return [`${base}.srt`, `${base}.ass`]
}

function folderFileSet(files: string[] | null | undefined): Set<string> {
  const s = new Set<string>()
  if (!files) return s
  for (const f of files) {
    if (typeof f === "string" && f.trim()) s.add(Path.posix(f.trim()))
  }
  return s
}

/**
 * Builds rows for {@link UISubtitleTranslationDialog} from TV/movie {@link MediaMetadata.mediaFiles}.
 */
export function subtitleTranslationDialogRowsFromMediaFiles(
  mediaMetadata: MediaMetadata | undefined,
): SubtitleTranslationDialogRow[] {
  const files = mediaMetadata?.mediaFiles
  if (!mediaMetadata || !files?.length) return []

  const folder = mediaMetadata.mediaFolderPath
  const out: SubtitleTranslationDialogRow[] = []

  for (const mf of files) {
    const mediaPath = Path.posix(mf.absolutePath)
    const label = labelForMediaFile(mediaMetadata, mf)
    const paths = mf.subtitleFilePaths ?? []
    if (paths.length === 0) {
      out.push({
        id: `no-subtitle:${mediaPath}`,
        path: "",
        mediaPath,
        displayPath: displayPathForFile(folder, mediaPath),
        title: label,
        eligible: false,
        disabledReason: "subtitleTranslationDialog.noSubtitleFile",
      })
      continue
    }
    for (const sub of paths) {
      const sp = Path.posix(sub)
      out.push({
        id: sp,
        path: sp,
        mediaPath,
        displayPath: displayPathForFile(folder, sp),
        title: `${label} — ${basename(sp) ?? sp}`,
        eligible: true,
      })
    }
  }
  return out
}

/**
 * Builds rows from music table data; a row is eligible when a sibling `.srt` or `.ass` exists in `folderFiles`.
 */
export function subtitleTranslationDialogRowsFromMusicFileRows(
  rows: MusicFileRow[],
  mediaFolderPath: string | undefined,
  folderFiles: string[] | null | undefined,
): SubtitleTranslationDialogRow[] {
  const fileSet = folderFileSet(folderFiles)
  const folder = mediaFolderPath?.trim() || undefined
  const out: SubtitleTranslationDialogRow[] = []

  for (const row of rows) {
    const mediaPath = absolutePosixMusicFilePath(row, folder)
    if (!mediaPath) continue
    const displayMedia = displayPathForFile(folder, mediaPath)
    const title = row.title?.trim() || basename(mediaPath) || mediaPath
    let found: string | undefined
    for (const c of siblingSubtitlePaths(mediaPath)) {
      if (fileSet.has(c)) {
        found = c
        break
      }
    }
    if (!found) {
      out.push({
        id: `no-subtitle:${mediaPath}`,
        path: "",
        mediaPath,
        displayPath: displayMedia,
        title,
        eligible: false,
        disabledReason: "subtitleTranslationDialog.noSubtitleFile",
      })
    } else {
      out.push({
        id: found,
        path: found,
        mediaPath,
        displayPath: displayPathForFile(folder, found),
        title: `${title} — ${basename(found) ?? found}`,
        eligible: true,
      })
    }
  }
  return out
}
