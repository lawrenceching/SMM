import { useCallback } from "react"
import { toast } from "sonner"
import { unlinkEpisode } from "@/components/TvShowPanelUtils"
import type { TvShowEpisodeDataRow } from "@/components/TvShowEpisodeTable"
import { handleEpisodeFileSelect as handleEpisodeFileSelectHelper } from "@/helpers/TvShowPanel/handleEpisodeFileSelect"
import { isElectron } from "@/lib/isElectron"
import { openNativeOpenDialog } from "@/lib/nativeFolderDialog"
import { nextTraceId } from "@/lib/utils"
import { castTranslationFn, useTranslation } from "@/lib/i18n"
import { useDialogs } from "@/providers/dialog-provider"
import { Path } from "@core/path"
import type { MediaMetadata } from "@core/types"

export interface UseSelectAndUnselectFileFlowOptions {
  mediaMetadata: MediaMetadata | undefined
  updateMediaMetadata: (
    path: string,
    updaterOrMetadata: MediaMetadata | ((current: MediaMetadata) => MediaMetadata),
    options?: { traceId?: string },
  ) => Promise<void>
}

export function useSelectAndUnselectFileFlow({
  mediaMetadata,
  updateMediaMetadata,
}: UseSelectAndUnselectFileFlowOptions) {
  const { t: i18nT } = useTranslation(["components"])
  const t = castTranslationFn(i18nT) as (key: string, options?: Record<string, unknown>) => string
  const { filePickerDialog } = useDialogs()
  const [openFilePicker] = filePickerDialog

  const requireMediaMetadata = useCallback((): MediaMetadata | undefined => {
    if (!mediaMetadata) {
      toast.error("No media metadata available")
      console.error("No media metadata available")
      return
    }

    if (!mediaMetadata.mediaFolderPath) {
      toast.error("No media folder path available")
      console.error("No media folder path available")
      return
    }

    return mediaMetadata
  }, [mediaMetadata])

  const handleEpisodeFileSelect = useCallback(
    (
      seasonNumber: number,
      episodeNumber: number,
      file: { path: string; isDirectory?: boolean },
    ) => {
      if (file.isDirectory) {
        toast.error(t("tvShowEpisodeTable.linkFileDirectoryError"))
        return
      }

      const currentMediaMetadata = requireMediaMetadata()
      if (!currentMediaMetadata) {
        return
      }

      const traceId = `UserLinkFileToEpisode-${nextTraceId()}`

      const updated = handleEpisodeFileSelectHelper(
        currentMediaMetadata,
        seasonNumber,
        episodeNumber,
        file.path,
        (errorMessage) => {
          toast.error(errorMessage)
        },
      )

      if (updated === currentMediaMetadata) {
        return
      }

      updateMediaMetadata(currentMediaMetadata.mediaFolderPath!, updated, { traceId })
    },
    [requireMediaMetadata, updateMediaMetadata, t],
  )

  const handleOpenFilePickerForEpisode = useCallback(
    (seasonNumber: number, episodeNumber: number) => {
      if (!mediaMetadata?.mediaFolderPath) {
        toast.error("No media metadata available")
        return
      }

      if (typeof window !== "undefined") {
        try {
          const mockFilePick = window.localStorage.getItem("test.mockFilePick")
          console.log(`[Mock] mock file pick: ${mockFilePick}`)
          if (mockFilePick && mockFilePick.trim().length > 0) {
            handleEpisodeFileSelect(seasonNumber, episodeNumber, {
              path: mockFilePick,
              isDirectory: false,
            })
            return
          }
        } catch (error) {
          console.error(
            "[useSelectAndUnselectFileFlow] Failed to read localStorage.test.mockFilePick:",
            error,
          )
        }
      }

      const mediaFolderPlatformPath = Path.toPlatformPath(mediaMetadata.mediaFolderPath)

      if (isElectron()) {
        void openNativeOpenDialog({
          properties: ["openFile"],
          title: "Select Video File",
          defaultPath: mediaFolderPlatformPath,
          filters: [
            {
              name: "Video Files",
              extensions: ["mp4", "mkv", "avi", "mov", "wmv", "flv", "webm", "m4v", "ts"],
            },
            { name: "All Files", extensions: ["*"] },
          ],
        })
          .then((selectedFile) => {
            if (selectedFile) {
              handleEpisodeFileSelect(seasonNumber, episodeNumber, selectedFile)
            }
          })
          .catch((error: Error) => {
            console.error(
              "[useSelectAndUnselectFileFlow] Error opening native dialog:",
              error,
            )
            toast.error(`Failed to open file dialog: ${error.message}`)
          })
      } else {
        openFilePicker(
          (selectedFile) => {
            handleEpisodeFileSelect(seasonNumber, episodeNumber, selectedFile)
          },
          {
            title: "Select Video File",
            description: "Choose a video file for this episode",
            selectFolder: false,
            initialPath: mediaFolderPlatformPath,
          },
        )
      }
    },
    [mediaMetadata, openFilePicker, handleEpisodeFileSelect],
  )

  const onSelectFileContextMenuClick = useCallback(
    (row: TvShowEpisodeDataRow) => {
      handleOpenFilePickerForEpisode(row.season, row.episode)
    },
    [handleOpenFilePickerForEpisode],
  )

  const onUnlinkContextMenuClick = useCallback(
    (row: TvShowEpisodeDataRow) => {
      unlinkEpisode({
        season: row.season,
        episode: row.episode,
        mediaMetadata,
        updateMediaMetadata,
        t,
      })
    },
    [mediaMetadata, updateMediaMetadata, t],
  )

  return {
    onSelectFileContextMenuClick,
    onUnlinkContextMenuClick,
  }
}
