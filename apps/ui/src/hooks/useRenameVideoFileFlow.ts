import { useCallback } from "react"
import { toast } from "sonner"
import { Path } from "@smm/utils/path"
import { useTranslation } from "@/lib/i18n"
import { join, relative } from "@/lib/path"
import { renameEpisodeFileViaCore } from "@/api/renameEpisodeFile"
import { useFetchMediaMetadataMutation } from "@/hooks/mediaMetadata/useFetchMediaMetadataMutation"
import type { UIMediaFileDataRow } from "@/components/media/UIMediaFileTable"

interface RenameFileDialogOptions {
  initialValue?: string
  title?: string
  description?: string
  suggestions?: string[]
}

export interface UseRenameVideoFileFlowOptions {
  /**
   * Absolute path to the media folder the renamed file lives in.
   * `undefined` disables the flow (the click handler becomes a no-op).
   */
  mediaFolderPath: string | undefined
  /**
   * Optional hook called after rename succeeds and before
   * `fetchMediaMetadata`. Lets the panel refresh local state synchronously
   * (e.g. clear checked rows) before the server re-fetch lands.
   */
  onAfterRename?: () => void | Promise<void>
  /**
   * Injected by the component layer — opens the rename-file dialog.
   * Decouples this flow hook from the global dialog provider.
   */
  openRenameDialog: (
    onConfirm: (newName: string) => void,
    options?: RenameFileDialogOptions,
  ) => void
}

export interface RenameVideoFileFlow {
  /**
   * Open the rename dialog for `row` and, on confirm, rename the video file
   * via Core `renameEpisodeFile`, then refetch the media folder metadata.
   * No-op when the row has no `videoFile` or the hook was constructed without
   * a `mediaFolderPath`.
   */
  onRenameContextMenuClick: (row: UIMediaFileDataRow) => void
}

/**
 * Encapsulates the "rename the selected video file" right-click flow that
 * `TvShowPanel` and `MoviePanel` inject into `MediaFileTable`.
 *
 * TV + movie: `POST /api/rename-episode-file` → Core.
 */
export function useRenameVideoFileFlow(
  options: UseRenameVideoFileFlowOptions,
): RenameVideoFileFlow {
  const { mediaFolderPath, onAfterRename, openRenameDialog } = options
  const { t } = useTranslation(["components", "dialogs"])
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

      openRenameDialog(
        async (newRelativePath: string) => {
          if (!row.videoFile) return
          const newAbsolutePath = join(mediaFolderPath, newRelativePath)
          try {
            await renameEpisodeFileViaCore({
              mediaFolder: Path.posix(mediaFolderPath),
              from: row.videoFile,
              to: newAbsolutePath,
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
    [
      mediaFolderPath,
      onAfterRename,
      openRenameDialog,
      fetchMediaMetadata,
      t,
    ],
  )

  return { onRenameContextMenuClick }
}
