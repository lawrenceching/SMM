import { useEffect, useRef } from "react"
import { useMount, useUnmount } from "react-use"
import { useQueryClient } from "@tanstack/react-query"
import { importLibraryViaCore } from "@/api/importLibrary"
import { useJobManager } from "@/hooks/useJobManager"
import { nextTraceId } from "@/lib/utils"
import { UI_MediaLibraryImportedEvent, type OnMediaLibraryImportedEventData } from "@/types/eventTypes"
import debug from "debug"
import { useUIMediaFolderStore } from "@/stores/uiMediaFolderStore"
import { useRefreshUserConfig } from "@/hooks/userConfig"
import { persistHarmonyOSFileAccess } from "@/lib/persistHarmonyOSFileAccess"
import { toast } from "sonner"
import { useTranslation } from "@/lib/i18n"
import { foldersQueryKey } from "@/hooks/folders/foldersQueryKeys"
import {
  buildUiFoldersFromShowFolder,
  folderTypeToMediaType,
  pollImportLibraryJob,
} from "@/lib/importLibraryV3"

export function MediaLibraryImportedEventHandler() {
  const { t: tComponents } = useTranslation("components")
  const tRef = useRef(tComponents)
  useEffect(() => { tRef.current = tComponents }, [tComponents])

  const eventListener = useRef<((event: Event) => void) | null>(null)
  const refreshUserConfig = useRefreshUserConfig()
  const queryClient = useQueryClient()
  const upsertFolder = useUIMediaFolderStore((s) => s.upsertFolder)
  const { addJob, updateJob } = useJobManager()

  const doImportMediaLibrary = async (data: OnMediaLibraryImportedEventData) => {
    const { libraryPathInPlatformFormat, type } = data
    const traceIdBase = data.traceId || `MediaLibraryImportedEventHandler:${nextTraceId()}`
    console.log(`[${traceIdBase}] start import media library: ${JSON.stringify(data)}`)
    debug(`start ${UI_MediaLibraryImportedEvent}: ${JSON.stringify(data)}`)

    await persistHarmonyOSFileAccess([libraryPathInPlatformFormat])

    const jobId = addJob(tRef.current("statusBar.backgroundJobs.jobNames.importMediaLibrary"))
    updateJob(jobId, { status: "running", progress: 0 })

    try {
      const coreJobId = await importLibraryViaCore({
        path: libraryPathInPlatformFormat,
        type,
      })

      const finalJob = await pollImportLibraryJob(coreJobId, (job) => {
        updateJob(jobId, { progress: job.progress })
        if (job.currentFolderPath) {
          upsertFolder({
            path: job.currentFolderPath,
            status: "initializing",
            type: folderTypeToMediaType(type),
          })
        }
      })

      if (finalJob.status !== "succeeded") {
        throw new Error(finalJob.error ?? "Import media library failed")
      }

      await refreshUserConfig()
      const importedFolders = await buildUiFoldersFromShowFolder(finalJob.folderPaths)
      for (const folder of importedFolders) {
        upsertFolder(folder)
      }
      void queryClient.invalidateQueries({ queryKey: foldersQueryKey })

      updateJob(jobId, { status: "succeeded", progress: 100 })
    } catch (error) {
      console.error(`[${traceIdBase}] import media library failed:`, error)
      updateJob(jobId, { status: "failed" })
      toast.error(error instanceof Error ? error.message : "导入媒体库失败")
    }
  }

  useMount(() => {
    eventListener.current = (event) => {
      debug(`received ${UI_MediaLibraryImportedEvent} event`)
      const data = (event as CustomEvent<OnMediaLibraryImportedEventData>).detail
      void doImportMediaLibrary(data)
    }

    document.addEventListener(UI_MediaLibraryImportedEvent, eventListener.current)
  })

  useUnmount(() => {
    if (eventListener.current) {
      document.removeEventListener(UI_MediaLibraryImportedEvent, eventListener.current)
    }
  })

  return <></>
}
