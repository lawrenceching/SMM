import { useWebSocketEvent } from "@/hooks/useWebSocket"
import { AskForRenameFilesConfirmation } from "@core/event-types"
import type { AskForRenameFilesConfirmationBeginRequestData } from "@core/event-types"
import { queryClient } from "@/lib/queryClient"
import { PLANS_QUERY_ROOT } from "@/hooks/plans"

interface UseTvShowWebSocketEventsParams {
  setSelectedMediaMetadataByMediaFolderPath: (path: string) => void
}

function invalidatePlansQuery() {
  void queryClient.invalidateQueries({ queryKey: [PLANS_QUERY_ROOT] })
}

/**
 * Legacy rename WebSocket events (pre-plan-file API). Refreshes the plans
 * query so AI rename preview/prompt stay in sync with the active plan.
 */
export function useTvShowWebSocketEvents({
  setSelectedMediaMetadataByMediaFolderPath,
}: UseTvShowWebSocketEventsParams) {
  useWebSocketEvent((message) => {
    if (message.event === AskForRenameFilesConfirmation.event) {
      console.error(`socket event "${AskForRenameFilesConfirmation.event}" is not supported anymore`)
    } else if (message.event === AskForRenameFilesConfirmation.beginEvent) {
      console.log("AskForRenameFilesConfirmation.beginEvent received", message.data)
      const data: AskForRenameFilesConfirmationBeginRequestData =
        message.data as AskForRenameFilesConfirmationBeginRequestData
      setSelectedMediaMetadataByMediaFolderPath(data.mediaFolderPath)
      invalidatePlansQuery()
    } else if (message.event === AskForRenameFilesConfirmation.addFileEvent) {
      console.log("AskForRenameFilesConfirmation.addFileEvent received", message.data)
      invalidatePlansQuery()
    } else if (message.event === AskForRenameFilesConfirmation.endEvent) {
      console.log("AskForRenameFilesConfirmation.endEvent received", message.data)
      invalidatePlansQuery()
    }
  })
}
