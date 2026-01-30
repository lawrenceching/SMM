import { useWebSocketEvent } from "@/hooks/useWebSocket"
import { AskForRenameFilesConfirmation } from "@core/event-types"
import type { 
  AskForRenameFilesConfirmationBeginRequestData,
  AskForRenameFilesConfirmationAddFileResponseData,
} from "@core/event-types"
import type { MediaMetadata } from "@core/types"
import type { SeasonModel } from "../TvShowPanel"
import { renameFiles } from "../TvShowPanelUtils"

interface UseTvShowWebSocketEventsParams {
  mediaMetadata: MediaMetadata | undefined
  setSeasons: (updater: (prev: SeasonModel[]) => SeasonModel[]) => void
  setScrollToEpisodeId: (id: number | null) => void
  setSelectedMediaMetadataByMediaFolderPath: (path: string) => void
  openAiBasedRenameFilePrompt: (params: {
    status: "generating" | "wait-for-ack"
    onConfirm: () => void
    onCancel?: () => void
  }) => void
  setAiBasedRenameFileStatus: (status: "generating" | "wait-for-ack") => void
}

export function useTvShowWebSocketEvents({
  mediaMetadata,
  setSeasons,
  setScrollToEpisodeId,
  setSelectedMediaMetadataByMediaFolderPath,
  openAiBasedRenameFilePrompt,
  setAiBasedRenameFileStatus,
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

      setSeasons(prev => {
        return prev.map(season => ({
          ...season,
          episodes: season.episodes.map(episode => ({
            ...episode,
            files: episode.files.map(file => ({
              ...file,
              newPath: undefined,
            })),
          })),
        }))
      })
    } else if (message.event === AskForRenameFilesConfirmation.addFileEvent) {
      console.log('AskForRenameFilesConfirmation.addFileEvent received', message.data);
      const data: AskForRenameFilesConfirmationAddFileResponseData = message.data as AskForRenameFilesConfirmationAddFileResponseData;
      const from = data.from;
      const to = data.to;

      setSeasons(prev => {
        let foundEpisodeId: number | null = null;
        const updatedSeasons = prev.map(season => ({
          ...season,
          episodes: season.episodes.map(episode => 
          {
            const videoFile = episode.files.find(file => file.type === "video");
            if(videoFile === undefined) {
              return episode;
            }

            if(videoFile.path !== from) {
              return episode;
            }

            // Found the matching episode, store its ID for scrolling
            foundEpisodeId = episode.episode.id;

            const newFileFromAI = {
              from: from,
              to: to,
            }

            if(newFileFromAI === undefined) {
              return episode;
            }

            const newFiles = renameFiles(mediaMetadata!.mediaFolderPath!, newFileFromAI.to, episode.files);
            return {
              episode: episode.episode,
              files: newFiles,
            }
          }
          ),
        }));

        // Set scroll target if episode was found
        if (foundEpisodeId !== null) {
          setScrollToEpisodeId(foundEpisodeId);
        }

        return updatedSeasons;
      })
    } else if (message.event === AskForRenameFilesConfirmation.endEvent) {
      console.log('AskForRenameFilesConfirmation.endEvent received', message.data);
      setAiBasedRenameFileStatus("wait-for-ack")
    }
  })
}
