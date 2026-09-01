import { useRef } from "react"
import { useMount, useUnmount } from "react-use"
import debug from "debug"
import { toast } from "sonner"
import { useImportFolderMutation } from "@/hooks/folders/useImportFolderMutation"
import { folderTypeToMediaType } from "@/lib/importLibraryV3"
import { persistHarmonyOSFileAccess } from "@/lib/persistHarmonyOSFileAccess"
import { nextTraceId } from "@/lib/utils"
import { useUIMediaFolderStore } from "@/stores/uiMediaFolderStore"
import { UI_ImportFolderEvent, type OnMediaFolderImportedEventData } from "@/types/eventTypes"

export function ImportFolderEventHandler() {
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
