import { useRef } from "react"
import { useMount, useUnmount } from "react-use"
import { listFiles } from "@/api/listFiles"
import { useBackgroundJobsStore } from "@/stores/backgroundJobsStore"
import { useConfig } from "@/providers/config-provider"
import { useMediaMetadataStoreActions, useMediaMetadataStoreState } from "@/stores/mediaMetadataStore"
import { useMediaMetadataActions } from "@/actions/mediaMetadataActions"
import { createMediaMetadata } from "@core/mediaMetadata"
import type { UIMediaMetadata } from "@/types/UIMediaMetadata"
import { nextTraceId } from "@/lib/utils"
import { Path } from "@core/path"
import { UI_MediaLibraryImportedEvent, type OnMediaLibraryImportedEventData } from "@/types/eventTypes"
import { initializeSingleMediaFolder } from "@/lib/initializeSingleMediaFolder"
import { Mutex } from "es-toolkit"
import { toast } from "sonner"
import Debug from "debug"
const debug = Debug("MediaLibraryImportedEventHandler")
const mediaLibraryImportMutex = new Mutex()

export function MediaLibraryImportedEventHandler() {
  const { addMediaFolderInUserConfig } = useConfig()
  const { mediaMetadatas } = useMediaMetadataStoreState()
  const { addMediaMetadatas, getMediaMetadata } = useMediaMetadataStoreActions()
  const { saveMediaMetadata, updateMediaMetadata, initializeMediaMetadata } = useMediaMetadataActions()
  const backgroundJobs = useBackgroundJobsStore()
  const eventListener = useRef<((event: Event) => void) | null>(null)

  const processMediaLibraryImportedEvent = async (event: Event) => {
    const data = (event as CustomEvent<OnMediaLibraryImportedEventData>).detail
    const { libraryPathInPlatformFormat, type } = data
    debug(`start to process ${UI_MediaLibraryImportedEvent} event`, data)
    const traceIdBase = data.traceId || `MediaLibraryImportedEventHandler:${nextTraceId()}`

    const jobId = backgroundJobs.addJob("Importing Media Library")
    backgroundJobs.updateJob(jobId, { status: "running", progress: 0 })
    debug(`add background job in running status`)

    try {
      const listFilesResponse = await listFiles({
        path: libraryPathInPlatformFormat,
        onlyFolders: true,
        includeHiddenFiles: false,
      })

      if (listFilesResponse.error || !listFilesResponse.data) {
        console.error(`[${traceIdBase}] Failed to list folders in media library: ${listFilesResponse.error}`)
        backgroundJobs.updateJob(jobId, { status: "failed" })
        return
      }

      debug(`listed ${listFilesResponse.data?.items.length} folders`)

      const subfolderPaths = Array.from(
        new Set(
          listFilesResponse.data.items
            .filter((item) => item.isDirectory && item.path)
            .map((item) => item.path!)
        )
      )

      const existingPaths = new Set(mediaMetadatas.map((metadata) => metadata.mediaFolderPath).filter(Boolean))
      const pathsToImport = subfolderPaths.filter((path) => !existingPaths.has(Path.posix(path)))

      if (pathsToImport.length === 0) {
        backgroundJobs.updateJob(jobId, { status: "succeeded", progress: 100 })
        return
      }

      const mediaType = type === "tvshow" ? "tvshow-folder" : type === "movie" ? "movie-folder" : "music-folder"
      const placeholders: UIMediaMetadata[] = pathsToImport.map((path) => ({
        ...createMediaMetadata(path, mediaType),
        status: "initializing",
      }))

      addMediaMetadatas(placeholders)
      debug(`added ${placeholders.length} placeholder UIMediaMetadatas`)

      const deps = {
        addMediaFolderInUserConfig,
        getMediaMetadata,
        saveMediaMetadata,
        updateMediaMetadata,
        initializeMediaMetadata,
      }

      let completed = 0
      for (const path of pathsToImport) {
        debug(`start to import ${path}`)
        const traceId = `${traceIdBase}:${nextTraceId()}`
        try {
          await initializeSingleMediaFolder(path, type, traceId, deps, {
            onError: (message) => toast.error(message),
          })
        } catch {
          // Error already reported via onError; continue with next folder
        }
        completed += 1
        backgroundJobs.updateJob(jobId, {
          progress: (completed / pathsToImport.length) * 100,
          status: completed === pathsToImport.length ? "succeeded" : "running",
        })
        debug(`succeeded to import ${path}`)
      }
      debug(`completed to import ${pathsToImport.length} folders`)
    } catch (error) {
      console.error(`[${traceIdBase}] Import media library failed:`, error)
      backgroundJobs.updateJob(jobId, { status: "failed" })
      debug(`failed to import media library`, error)
    }
  }

  useMount(() => {
    eventListener.current = (event) => {
      debug(`received ${UI_MediaLibraryImportedEvent} event`)
      ;(async () => {
        try {
          await mediaLibraryImportMutex.acquire()
          await processMediaLibraryImportedEvent(event)
        } catch (error) {
          console.error("Failed to process media library import event:", error)
        } finally {
          mediaLibraryImportMutex.release()
        }
      })()
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

