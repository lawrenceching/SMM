import { useCallback } from "react"
import { toast } from "sonner"
import { useTranslation } from "@/lib/i18n"
import { join, relative } from "@/lib/path"
import { renameFiles } from "@/api/renameFiles"
import { useDialogs } from "@/providers/dialog-provider"
import { computeAssociatedFileRenames } from "@/components/episode-file"
import { useFetchMediaMetadataMutation } from "@/hooks/mediaMetadata/useFetchMediaMetadataMutation"
import type { UIMediaFileDataRow } from "@/components/media/UIMediaFileTable"

export interface UseRenameVideoFileFlowOptions {
  /**
   * Absolute path to the media folder the renamed file lives in.
   * `undefined` disables the flow (the click handler becomes a no-op).
   */
  mediaFolderPath: string | undefined
  /**
   * Every file path (absolute) that belongs to the media folder. Used by
   * `computeAssociatedFileRenames` to find sibling subtitle / thumbnail / nfo
   * files that share the video file's stem.
   */
  files: string[]
  /**
   * Optional hook called after `renameFiles` succeeds and before
   * `fetchMediaMetadata`. Lets the panel refresh local state synchronously
   * (e.g. clear checked rows) before the server re-fetch lands.
   */
  onAfterRename?: () => void | Promise<void>
}

export interface RenameVideoFileFlow {
  /**
   * Open the rename dialog for `row` and, on confirm, rename the video file
   * (and any associated files) via `renameFiles`, then refetch the media
   * folder metadata. No-op when the row has no `videoFile` or the hook was
   * constructed without a `mediaFolderPath`.
   */
  onRenameContextMenuClick: (row: UIMediaFileDataRow) => void
}

/**
 * Encapsulates the "rename the selected video file" right-click flow that
 * `TvShowPanel` and `MoviePanel` inject into `MediaFileTable`.
 *
 * The flow:
 *  1. Resolves the row's video path relative to the media folder and pre-fills
 *     the rename dialog with that relative path.
 *  2. On confirm, calls `renameFiles` for the video file plus every associated
 *     file (same stem, any extension) in one batch.
 *  3. Calls `onAfterRename` (if provided) to let the panel sync local state.
 *  4. Refetches the media folder metadata so the table reflects the rename.
 *  5. Toasts success / failure.
 *
 * Mirrors the long-standing `TvShowEpisodeTable` rename behavior; extracted
 * into a hook so `MediaFileTable` can stay free of rename business logic.
 */
export function useRenameVideoFileFlow(
  options: UseRenameVideoFileFlowOptions,
): RenameVideoFileFlow {
  const { mediaFolderPath, files, onAfterRename } = options
  const { t } = useTranslation(["components", "dialogs"])
  const { renameFileDialog } = useDialogs()
  const [openRename] = renameFileDialog
  const { mutateAsync: fetchMediaMetadata } = useFetchMediaMetadataMutation()

  const onRenameContextMenuClick = useCallback(
    (row: UIMediaFileDataRow) => {
      if (!row.videoFile || !mediaFolderPath) return

      let initialValue: string
      try {
        initialValue = relative(mediaFolderPath, row.videoFile)
      } catch {
        initialValue = row.videoFile
      }

      openRename(
        async (newRelativePath: string) => {
          if (!row.videoFile) return
          const newAbsolutePath = join(mediaFolderPath, newRelativePath)
          try {
            const assocRenames = computeAssociatedFileRenames(
              row.videoFile,
              newAbsolutePath,
              files,
            )
            await renameFiles({
              files: [
                { from: row.videoFile, to: newAbsolutePath },
                ...assocRenames,
              ],
            })
            await onAfterRename?.()
            await fetchMediaMetadata({ path: mediaFolderPath })
            toast.success(t("episodeFile.renameSuccess"))
          } catch (error) {
            const errorMessage =
              error instanceof Error
                ? error.message
                : t("episodeFile.renameFailed")
            toast.error(t("episodeFile.renameFailed"), {
              description: errorMessage,
            })
            throw error
          }
        },
        {
          initialValue,
          title: t("dialogs:rename.title"),
          description: t("dialogs:rename.fileDescription"),
        },
      )
    },
    [mediaFolderPath, files, onAfterRename, openRename, fetchMediaMetadata, t],
  )

  return { onRenameContextMenuClick }
}
