import type { MediaMetadata } from "@core/types"
import type { SynthesizeSubtitleDialogRow } from "@/components/dialogs/types"
import type { LocalFileTableRowData } from "@/components/MusicFileTable"
import { basename, relative } from "@/lib/path"
import { Path } from "@core/path"
import { absolutePosixMusicFilePath, labelForMediaFile } from "@/lib/transcribeDialogRows"

const VIDEO_SYNTHESIZE_EXTENSIONS = new Set([
  "mp4",
  "mkv",
  "webm",
  "mov",
  "avi",
  "m4v",
  "wmv",
  "flv",
])

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

function posixExtLower(posixPath: string): string {
  const last = posixPath.lastIndexOf(".")
  if (last <= 0 || last >= posixPath.length - 1) return ""
  return posixPath.slice(last + 1).toLowerCase()
}

export function isPosixPathVideoForSynthesize(posixPath: string): boolean {
  return VIDEO_SYNTHESIZE_EXTENSIONS.has(posixExtLower(posixPath))
}

function stablePairId(videoPosix: string, subtitlePosix: string): string {
  return `${videoPosix}\n${subtitlePosix}`
}

/**
 * Builds rows for {@link UISynthesizeSubtitleDialog} from TV/movie {@link MediaMetadata.mediaFiles}.
 */
export function synthesizeSubtitleDialogRowsFromMediaFiles(
  mediaMetadata: MediaMetadata | undefined,
): SynthesizeSubtitleDialogRow[] {
  const files = mediaMetadata?.mediaFiles
  if (!mediaMetadata || !files?.length) return []

  const folder = mediaMetadata.mediaFolderPath
  const out: SynthesizeSubtitleDialogRow[] = []

  for (const mf of files) {
    const mediaPath = Path.posix(mf.absolutePath)
    const label = labelForMediaFile(mediaMetadata, mf)
    const paths = mf.subtitleFilePaths ?? []
    if (!isPosixPathVideoForSynthesize(mediaPath)) {
      out.push({
        id: `no-video:${mediaPath}`,
        videoPath: mediaPath,
        subtitlePath: "",
        displayPath: displayPathForFile(folder, mediaPath),
        title: label,
        eligible: false,
        disabledReason: "synthesizeSubtitleDialog.notVideoFile",
      })
      continue
    }
    if (paths.length === 0) {
      out.push({
        id: `no-subtitle:${mediaPath}`,
        videoPath: mediaPath,
        subtitlePath: "",
        displayPath: displayPathForFile(folder, mediaPath),
        title: label,
        eligible: false,
        disabledReason: "synthesizeSubtitleDialog.noSubtitleFile",
      })
      continue
    }
    for (const sub of paths) {
      const sp = Path.posix(sub)
      out.push({
        id: stablePairId(mediaPath, sp),
        videoPath: mediaPath,
        subtitlePath: sp,
        displayPath: displayPathForFile(folder, sp),
        title: `${label} — ${basename(sp) ?? sp}`,
        eligible: true,
      })
    }
  }
  return out
}

/**
 * Builds rows from music table data; eligible when file is a supported video container and a sibling subtitle exists in `folderFiles`.
 */
export function synthesizeSubtitleDialogRowsFromMusicFileRows(
  rows: LocalFileTableRowData[],
  mediaFolderPath: string | undefined,
  folderFiles: string[] | null | undefined,
): SynthesizeSubtitleDialogRow[] {
  const fileSet = folderFileSet(folderFiles)
  const folder = mediaFolderPath?.trim() || undefined
  const out: SynthesizeSubtitleDialogRow[] = []

  for (const row of rows) {
    const mediaPath = absolutePosixMusicFilePath(row, folder)
    if (!mediaPath) continue
    const displayMedia = displayPathForFile(folder, mediaPath)
    const title = row.title?.trim() || basename(mediaPath) || mediaPath
    if (!isPosixPathVideoForSynthesize(mediaPath)) {
      out.push({
        id: `no-video:${mediaPath}`,
        videoPath: mediaPath,
        subtitlePath: "",
        displayPath: displayMedia,
        title,
        eligible: false,
        disabledReason: "synthesizeSubtitleDialog.notVideoFile",
      })
      continue
    }
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
        videoPath: mediaPath,
        subtitlePath: "",
        displayPath: displayMedia,
        title,
        eligible: false,
        disabledReason: "synthesizeSubtitleDialog.noSubtitleFile",
      })
    } else {
      out.push({
        id: stablePairId(mediaPath, found),
        videoPath: mediaPath,
        subtitlePath: found,
        displayPath: displayPathForFile(folder, found),
        title: `${title} — ${basename(found) ?? found}`,
        eligible: true,
      })
    }
  }
  return out
}
