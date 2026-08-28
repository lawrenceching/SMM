import { useCallback } from "react"
import { toast } from "sonner"
import { Path } from "@core/path"
import { useTranslation } from "@/lib/i18n"
import { join, relative } from "@/lib/path"
import { renameFiles } from "@/api/renameFiles"
import { renameEpisodeFileViaCore } from "@/api/renameEpisodeFile"
import { useDialogs } from "@/providers/dialog-provider"
import { computeAssociatedFileRenames } from "@/components/episode-file"
import { useFetchMediaMetadataMutation } from "@/hooks/mediaMetadata/useFetchMediaMetadataMutation"
import { isSmmV3Enabled } from "@/lib/localStorages"
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
   * files that share the video file's stem (legacy / movie path only).
   */
  files: string[]
  /**
   * When `smm.v3.enabled`, confirm calls Core `renameEpisodeFile` (TV + movie).
   * Default `"generic"` keeps legacy `/api/renameFiles` when v3 is off.
   */
  mode?: "episode" | "generic"
  /**
   * Optional hook called after rename succeeds and before
   * `fetchMediaMetadata`. Lets the panel refresh local state synchronously
   * (e.g. clear checked rows) before the server re-fetch lands.
   */
  onAfterRename?: () => void | Promise<void>
}

export interface RenameVideoFileFlow {
  /**
   * Open the rename dialog for `row` and, on confirm, rename the video file
   * (and any associated files), then refetch the media folder metadata.
   * No-op when the row has no `videoFile` or the hook was constructed without
   * a `mediaFolderPath`.
   */
  onRenameContextMenuClick: (row: UIMediaFileDataRow) => void
}

/**
 * Encapsulates the "rename the selected video file" right-click flow that
 * `TvShowPanel` and `MoviePanel` inject into `MediaFileTable`.
 *
 * TV + movie + v3 ON: `POST /api/rename-episode-file` → Core.
 * Otherwise: client expands associates and calls `POST /api/renameFiles`.
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
            if (isSmmV3Enabled()) {
              await renameEpisodeFileViaCore({
                mediaFolder: Path.posix(mediaFolderPath),
                from: row.videoFile,
                to: newAbsolutePath,
              })
            } else {
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
                mediaFolder: Path.posix(mediaFolderPath),
              })
            }
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
      files,
      onAfterRename,
      openRename,
      fetchMediaMetadata,
      t,
    ],
  )

  return { onRenameContextMenuClick }
}
