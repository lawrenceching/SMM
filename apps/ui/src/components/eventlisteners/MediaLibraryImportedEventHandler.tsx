import { useRef } from "react"
import { useMount, useUnmount } from "react-use"
import { listFiles } from "@/api/listFiles"
import { useBackgroundJobsStore } from "@/stores/backgroundJobsStore"
import { useConfig } from "@/providers/config-provider"
import { useMediaMetadataStoreActions, useMediaMetadataStoreState } from "@/stores/mediaMetadataStore"
import { createMediaMetadata } from "@core/mediaMetadata"
import type { UIMediaMetadata } from "@/types/UIMediaMetadata"
import { nextTraceId } from "@/lib/utils"
import { Path } from "@core/path"
import {
  UI_MediaFolderImportedEvent,
  UI_MediaLibraryImportedEvent,
  type OnMediaFolderImportedEventData,
  type OnMediaLibraryImportedEventData,
} from "@/types/eventTypes"
import { Mutex } from "es-toolkit"

const mediaLibraryImportMutex = new Mutex()

export function MediaLibraryImportedEventHandler() {
  const { addMediaFolderInUserConfig } = useConfig()
  const { mediaMetadatas } = useMediaMetadataStoreState()
  const { addMediaMetadatas } = useMediaMetadataStoreActions()
  const backgroundJobs = useBackgroundJobsStore()
  const eventListener = useRef<((event: Event) => void) | null>(null)

  const processMediaLibraryImportedEvent = async (event: Event) => {
    const data = (event as CustomEvent<OnMediaLibraryImportedEventData>).detail
    const { libraryPathInPlatformFormat, type } = data
    const traceIdBase = data.traceId || `MediaLibraryImportedEventHandler:${nextTraceId()}`

    const jobId = backgroundJobs.addJob("Importing Media Library")
    backgroundJobs.updateJob(jobId, { status: "running", progress: 0 })

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

      // Batch optimistic update to avoid N UI renders.
      addMediaMetadatas(placeholders)

      let completed = 0
      for (const path of pathsToImport) {
        const traceId = `${traceIdBase}:${nextTraceId()}`
        await addMediaFolderInUserConfig(traceId, path)

        await new Promise<void>((resolve) => {
          const detail: OnMediaFolderImportedEventData = {
            type,
            folderPathInPlatformFormat: path,
            traceId,
            skipOptimisticUpdate: true,
            onCompleted: () => {
              completed += 1
              backgroundJobs.updateJob(jobId, {
                progress: (completed / pathsToImport.length) * 100,
                status: completed === pathsToImport.length ? "succeeded" : "running",
              })
              resolve()
            },
          }
          document.dispatchEvent(new CustomEvent(UI_MediaFolderImportedEvent, { detail }))
        })
      }
    } catch (error) {
      console.error(`[${traceIdBase}] Import media library failed:`, error)
      backgroundJobs.updateJob(jobId, { status: "failed" })
    }
  }

  useMount(() => {
    eventListener.current = (event) => {
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

