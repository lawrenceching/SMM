import { useEffect, useRef } from "react"
import { useMount, useUnmount } from "react-use"
import { useQueryClient } from "@tanstack/react-query"
import { importLibraryViaCore } from "@/api/importLibrary"
import { getJobViaCore } from "@/api/getJob"
import { useJobManager } from "@/hooks/useJobManager"
import { nextTraceId } from "@/lib/utils"
import { UI_MediaLibraryImportedEvent, type OnMediaLibraryImportedEventData } from "@/types/eventTypes"
import debug from "debug"
import { useUIMediaFolderStore } from "@/stores/uiMediaFolderStore"
import { useRefreshUserConfig } from "@/hooks/userConfig"
import { invalidateFoldersQueryIfV3 } from "@/hooks/folders"
import { persistHarmonyOSFileAccess } from "@/lib/persistHarmonyOSFileAccess"
import { toast } from "sonner"
import { useTranslation } from "@/lib/i18n"
import { importLibraryLog } from "@/lib/importLibraryLog"
import {
  buildUiFoldersFromShowFolder,
  folderTypeToMediaType,
  pollImportLibraryJob,
  syncSidebarFromImportLibraryJob,
  waitForLibraryFoldersRegistered,
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
    const traceId = data.traceId || `MediaLibraryImportedEventHandler:${nextTraceId()}`
    const trace = { traceId }
    const mediaType = folderTypeToMediaType(type)

    importLibraryLog(trace, "user import library", {
      libraryPath: libraryPathInPlatformFormat,
      type,
    })
    debug(`start ${UI_MediaLibraryImportedEvent}: ${JSON.stringify(data)}`)

    await persistHarmonyOSFileAccess([libraryPathInPlatformFormat])
    importLibraryLog(trace, "HarmonyOS file access persisted")

    const jobId = addJob(tRef.current("statusBar.backgroundJobs.jobNames.importMediaLibrary"))
    updateJob(jobId, { status: "running", progress: 0 })
    importLibraryLog(trace, "background job running", { uiJobId: jobId })

    try {
      const coreJobId = await importLibraryViaCore({
        path: libraryPathInPlatformFormat,
        type,
        traceId,
      })
      importLibraryLog(trace, "received core job id", { coreJobId, uiJobId: jobId })

      const registeredPaths = await waitForLibraryFoldersRegistered(coreJobId, trace)
      await refreshUserConfig()
      invalidateFoldersQueryIfV3(queryClient)
      importLibraryLog(trace, "sidebar folder list refreshed", {
        folderCount: registeredPaths.length,
        folderPaths: registeredPaths,
      })

      const prepJob = await getJobViaCore(coreJobId)
      if (prepJob.kind === "import-library") {
        syncSidebarFromImportLibraryJob(prepJob, upsertFolder, mediaType)
      }

      const finalJob = await pollImportLibraryJob(
        coreJobId,
        (job) => {
          updateJob(jobId, { progress: job.progress })
          syncSidebarFromImportLibraryJob(job, upsertFolder, mediaType)
        },
        trace,
      )

      if (finalJob.status !== "succeeded") {
        throw new Error(finalJob.error ?? "Import media library failed")
      }

      const importedFolders = await buildUiFoldersFromShowFolder(
        finalJob.tasks.map((task) => task.path),
        trace,
      )
      for (const folder of importedFolders) {
        upsertFolder(folder)
      }
      await refreshUserConfig()
      invalidateFoldersQueryIfV3(queryClient)
      importLibraryLog(trace, "sidebar folder status synced after import", {
        folderCount: importedFolders.length,
      })

      updateJob(jobId, { status: "succeeded", progress: 100 })
      importLibraryLog(trace, "background job succeeded", { uiJobId: jobId, coreJobId })
    } catch (error) {
      console.error(`[${traceId}] import-library: failed`, error)
      importLibraryLog(trace, "background job failed", {
        uiJobId: jobId,
        error: error instanceof Error ? error.message : String(error),
      })
      updateJob(jobId, { status: "failed" })
      toast.error(error instanceof Error ? error.message : "导入媒体库失败")
    }
  }

  useMount(() => {
    eventListener.current = (event) => {
      const data = (event as CustomEvent<OnMediaLibraryImportedEventData>).detail
      importLibraryLog(
        data.traceId ? { traceId: data.traceId } : undefined,
        "received import library event",
        { libraryPath: data.libraryPathInPlatformFormat, type: data.type },
      )
      debug(`received ${UI_MediaLibraryImportedEvent} event`)
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
