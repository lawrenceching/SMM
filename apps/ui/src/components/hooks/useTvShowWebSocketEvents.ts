import { useWebSocketEvent } from "@/hooks/useWebSocket"
import { AskForRenameFilesConfirmation } from "@core/event-types"
import type { 
  AskForRenameFilesConfirmationBeginRequestData,
  AskForRenameFilesConfirmationAddFileResponseData,
} from "@core/event-types"
import type { MediaMetadata } from "@core/types"
import type { UIMediaMetadata } from "@/types/UIMediaMetadata"

interface UseTvShowWebSocketEventsParams {
  mediaMetadata: MediaMetadata | undefined
  setScrollToEpisodeId?: (id: number | null) => void
  setSelectedMediaMetadataByMediaFolderPath: (path: string) => void
  openAiBasedRenameFilePrompt: (params: {
    status: "generating" | "wait-for-ack"
    onConfirm: () => void
    onCancel?: () => void
  }) => void
  setAiBasedRenameFileStatus: (status: "generating" | "wait-for-ack") => void
  updateMediaMetadata: (path: string, updaterOrMetadata: UIMediaMetadata | ((current: UIMediaMetadata) => UIMediaMetadata), options?: { traceId?: string }) => void | Promise<void>
}

export function useTvShowWebSocketEvents({
  mediaMetadata,
  setSelectedMediaMetadataByMediaFolderPath,
  openAiBasedRenameFilePrompt,
  setAiBasedRenameFileStatus,
  updateMediaMetadata,
}: UseTvShowWebSocketEventsParams) {
  useWebSocketEvent((message) => {
    // Handle getSelectedMediaMetadata event with Socket.IO acknowledgement
    if (message.event === AskForRenameFilesConfirmation.event) {
      console.error(`socket event "${AskForRenameFilesConfirmation.event}" is not supported anymore`)
    } else if (message.event === AskForRenameFilesConfirmation.beginEvent) {
      console.log('AskForRenameFilesConfirmation.beginEvent received', message.data);
      const data: AskForRenameFilesConfirmationBeginRequestData = message.data as AskForRenameFilesConfirmationBeginRequestData;
      const mediaFolderPath = data.mediaFolderPath;

      setSelectedMediaMetadataByMediaFolderPath(mediaFolderPath)
      openAiBasedRenameFilePrompt({
        status: "generating",
        onConfirm: () => {
          // This will be set by TvShowPanel
        },
        onCancel: () => {},
      })

      // Clear newPath for all media files
      if (mediaMetadata?.mediaFiles && mediaMetadata.mediaFolderPath) {
        const updatedMediaFiles = mediaMetadata.mediaFiles.map(file => ({
          ...file,
          newPath: undefined,
        }));
        updateMediaMetadata(mediaMetadata.mediaFolderPath, (current) => ({
          ...current,
          mediaFiles: updatedMediaFiles,
        }));
      }
    } else if (message.event === AskForRenameFilesConfirmation.addFileEvent) {
      console.log('AskForRenameFilesConfirmation.addFileEvent received', message.data);
      const data: AskForRenameFilesConfirmationAddFileResponseData = message.data as AskForRenameFilesConfirmationAddFileResponseData;
      const from = data.from;
      const to = data.to;

      // Update media file with newPath
      if (mediaMetadata?.mediaFiles && mediaMetadata.mediaFolderPath) {
        const updatedMediaFiles = mediaMetadata.mediaFiles.map(file => {
          if (file.absolutePath === from) {
            return {
              ...file,
              newPath: to,
            };
          }
          return file;
        });
        updateMediaMetadata(mediaMetadata.mediaFolderPath, (current) => ({
          ...current,
          mediaFiles: updatedMediaFiles,
        }));
      }
    } else if (message.event === AskForRenameFilesConfirmation.endEvent) {
      console.log('AskForRenameFilesConfirmation.endEvent received', message.data);
      setAiBasedRenameFileStatus("wait-for-ack")
    }
  })
}
