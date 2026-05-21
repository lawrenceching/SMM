import type { MediaMetadata } from "@core/types"
import type { LocalFileTableRowData } from "@/components/MusicFileTable"
import type { ProcessPipelineDialogRow } from "@/components/dialogs/types"
import { transcribeDialogRowsFromMediaFiles, transcribeDialogRowsFromMusicFileRows } from "@/lib/transcribeDialogRows"

/**
 * Builds rows for {@link UIProcessPipelineDialog} from TV/movie {@link MediaMetadata.mediaFiles}.
 * Eligibility matches transcribe targets (resolvable media paths).
 */
export function processPipelineDialogRowsFromMediaFiles(
  mediaMetadata: MediaMetadata | undefined,
): ProcessPipelineDialogRow[] {
  return transcribeDialogRowsFromMediaFiles(mediaMetadata).map((r) => ({
    id: r.id,
    mediaPath: r.path,
    displayPath: r.displayPath,
    title: r.title,
    eligible: true,
  }))
}

/**
 * Builds rows from music table data (same path rules as {@link transcribeDialogRowsFromMusicFileRows}).
 */
export function processPipelineDialogRowsFromMusicFileRows(
  rows: LocalFileTableRowData[],
  mediaFolderPath?: string,
): ProcessPipelineDialogRow[] {
  return transcribeDialogRowsFromMusicFileRows(rows, mediaFolderPath).map((r) => ({
    id: r.id,
    mediaPath: r.path,
    displayPath: r.displayPath,
    title: r.title,
    eligible: true,
  }))
}
