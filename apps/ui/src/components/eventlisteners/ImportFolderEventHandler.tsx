import { useRef } from "react"
import { useMount, useUnmount } from "react-use"
import { useQueryClient } from "@tanstack/react-query"
import debug from "debug"
import { toast } from "sonner"
import { useImportFolderMutation } from "@/hooks/folders/useImportFolderMutation"
import { invalidateFoldersQuery } from "@/hooks/folders"
import { folderTypeToMediaType } from "@/lib/importLibrary"
import { persistHarmonyOSFileAccess } from "@/lib/persistHarmonyOSFileAccess"
import { pollImportFolderJob } from "@/lib/pollImportFolderJob"
import { showFolderViaCore } from "@/api/showFolder"
import {
  mediaMetadataQueryKey,
  normalizeMediaFolderPathForQuery,
} from "@/lib/mediaMetadataQueryKeys"
import { nextTraceId } from "@/lib/utils"
import { useUIMediaFolderStore } from "@/stores/uiMediaFolderStore"
import { UI_ImportFolderEvent, type OnMediaFolderImportedEventData } from "@/types/eventTypes"

export function ImportFolderEventHandler() {
  const queryClient = useQueryClient()
  const upsertFolder = useUIMediaFolderStore((s) => s.upsertFolder)
  const setSelectedFolder = useUIMediaFolderStore((s) => s.setSelectedFolder)
  const importFolderMutation = useImportFolderMutation()
  const eventListener = useRef<((event: Event) => void) | null>(null)

  const doImportFolder = async (data: OnMediaFolderImportedEventData) => {
    const { folderPathInPlatformFormat, type, skipOptimisticUpdate, onCompleted } = data
    const traceId = data.traceId ?? `ImportFolderEventHandler:${nextTraceId()}`
    const mediaType = folderTypeToMediaType(type)

    debug(`start ${UI_ImportFolderEvent}: ${JSON.stringify(data)}`)

    if (!skipOptimisticUpdate) {
      upsertFolder({
        path: folderPathInPlatformFormat,
        status: "initializing",
        type: mediaType,
      })
      setSelectedFolder(folderPathInPlatformFormat)
    }

    try {
      await persistHarmonyOSFileAccess([folderPathInPlatformFormat])
      const jobId = await importFolderMutation.mutateAsync({
        path: folderPathInPlatformFormat,
        type,
        traceId,
      })
      console.log(`[${traceId}] import-folder: started job`, { jobId })

      // Once Core has accepted the job, refresh get-folders so persisted paths
      // appear even before recognition finishes (config stage writes smm.json).
      invalidateFoldersQuery(queryClient)

      const finalJob = await pollImportFolderJob(jobId, (job) => {
        if (job.stage === "config" || job.progress > 0) {
          invalidateFoldersQuery(queryClient)
        }
      })

      if (finalJob.status !== "succeeded") {
        throw new Error(finalJob.error ?? "Import folder failed")
      }

      const show = await showFolderViaCore(folderPathInPlatformFormat)
      upsertFolder({
        path: show.path,
        status: show.status,
        ...(show.type !== undefined ? { type: show.type } : { type: mediaType }),
      })
      invalidateFoldersQuery(queryClient)
      void queryClient.invalidateQueries({
        queryKey: mediaMetadataQueryKey(
          normalizeMediaFolderPathForQuery(folderPathInPlatformFormat),
        ),
      })
      console.log(`[${traceId}] import-folder: succeeded`, { jobId, status: show.status })
    } catch (error) {
      console.error(`[${traceId}] import-folder: failed`, error)
      upsertFolder({
        path: folderPathInPlatformFormat,
        status: "error_loading_metadata",
        type: mediaType,
      })
      toast.error(error instanceof Error ? error.message : "Import folder failed")
    } finally {
      onCompleted?.()
    }
  }

  useMount(() => {
    eventListener.current = (event) => {
      const detail = (event as CustomEvent<OnMediaFolderImportedEventData>).detail
      void doImportFolder(detail)
    }

    document.addEventListener(UI_ImportFolderEvent, eventListener.current)
  })

  useUnmount(() => {
    if (eventListener.current) {
      document.removeEventListener(UI_ImportFolderEvent, eventListener.current)
    }
  })

  return <></>
}
