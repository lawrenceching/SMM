import { useRef } from "react"
import { useLatest, useMount, useUnmount } from "react-use"
import { listFiles } from "@/api/listFiles"
import { useJobManager } from "@/hooks/useJobManager"
import { nextTraceId } from "@/lib/utils"
import { Path } from "@core/path"
import { basename } from "@/lib/path"
import { sortPathsBySidebarDisplayOrder } from "@/stores/sidebarStore"
import { UI_MediaFolderImportedEvent, UI_MediaLibraryImportedEvent, type OnMediaLibraryImportedEventData } from "@/types/eventTypes"
import { isEqual, isNotNil } from "es-toolkit"
import debug from "debug"
import { useInitializeImportedMediaFolder } from "@/hooks/initialization/useInitializeImportedMediaFolder"
import { useUIMediaFolderStore, useUIMediaFolderStoreState } from "@/stores/uiMediaFolderStore"
import { useConfig, useSaveUserConfigMutation } from "@/hooks/userConfig"
import type { UIMediaFolder } from "@/types/UIMediaFolder"
import { persistHarmonyOSFileAccess } from "@/lib/persistHarmonyOSFileAccess"
import { logger } from "@/lib/log"
import { toast } from "sonner"
import { useTranslation } from "@/lib/i18n"

/**
 * folders - the absolute folder paths in platform format
 */
export function _dedupFolders(newFolders: string[], existingFolderPaths: string[]): string[] {
  const importedFolders: string[] = existingFolderPaths
    .filter((path) => path && Path.toPlatformPath(path))
    .filter(isNotNil)

  const importedPosix = new Set(importedFolders.map((p) => Path.posix(p)))
  return newFolders.filter((folder) => !importedPosix.has(Path.posix(folder)))
}

export async function _listFolders(path: string): Promise<string[]> {
  const listFilesResponse = await listFiles({
    path,
    onlyFolders: true,
    includeHiddenFiles: false,
  })
  return listFilesResponse.data?.items.map((item) => item.path) ?? []
}

export async function listLibraryFoldersWithAccess(libraryPath: string): Promise<string[]> {
  await persistHarmonyOSFileAccess([libraryPath])
  return _listFolders(libraryPath)
}

export function MediaLibraryImportedEventHandler() {

  const { t: tComponents } = useTranslation("components")
  const tRef = useRef(tComponents)
  tRef.current = tComponents

  const eventListener = useRef<((event: Event) => void) | null>(null)
  const { folders } = useUIMediaFolderStoreState()
  const setFolders = useUIMediaFolderStore((s) => s.setFolders)
  const latestFolders = useLatest(folders)
  const { initializeImportedMediaFolder } = useInitializeImportedMediaFolder();
  const { mutateAsync: saveUserConfig } = useSaveUserConfigMutation()
  const { userConfig } = useConfig()
  const latestUserConfig = useLatest(userConfig)
  const { addJob, updateJob } = useJobManager()

  const doImportMediaLibrary = async (event: Event) => {

    const data = (event as CustomEvent<OnMediaLibraryImportedEventData>).detail
    const { libraryPathInPlatformFormat, type } = data
    console.log(`start to initialize media library: ${JSON.stringify(data)}`)
    debug(`start to process ${UI_MediaLibraryImportedEvent} event: ${JSON.stringify(data)}`)
    const traceIdBase = data.traceId || `MediaLibraryImportedEventHandler:${nextTraceId()}`

    const jobId = addJob(tRef.current("statusBar.backgroundJobs.jobNames.importMediaLibrary"))

    try {

      const foldersInLibrary = await listLibraryFoldersWithAccess(libraryPathInPlatformFormat)
      debug(`listed ${foldersInLibrary.length} folders in library`)
      const foldersToImport = _dedupFolders(
        foldersInLibrary,
        latestFolders.current.map((folder) => folder.path),
      )
      debug(`deduped ${foldersToImport.length} folders, ${foldersToImport.length} folders need to import`)

      let progress = 0
      const updateProgress = () => {
        const delta = ~~(100 / foldersToImport.length)
        progress += delta
        updateJob(jobId, { progress: progress })
      }

      const uiMediaFolders = foldersToImport.map((folder) => ({
        path: folder,
        status: "pending_for_initialization",
      } as UIMediaFolder))

      setFolders(uiMediaFolders)

      await saveUserConfig({ traceId: traceIdBase, config: {
        ...latestUserConfig.current,
        folders: [...latestUserConfig.current.folders, ...foldersToImport],
      } })

      // Use Sidebar store sort order so initialization runs top-to-bottom as shown in Sidebar
      let foldersInSidebarOrder = sortPathsBySidebarDisplayOrder(foldersToImport, (path) => basename(path) ?? "")

      /**
       * Double check foldersInSidebarOrder contains all element in foldersToImport
       * In case sortPathsBySidebarDisplayOrder was implemented wrongly
       * And return array with missing folders
       */
      const foldersToInitialize = isEqual(foldersToImport, foldersInSidebarOrder) ? foldersInSidebarOrder : foldersToImport

      for (const folder of foldersToInitialize) {
        logger.info(`start to initialize folder ${folder}`)
        await initializeImportedMediaFolder(new CustomEvent(UI_MediaFolderImportedEvent, {
          detail: {
            type: type,
            folderPathInPlatformFormat: folder,
            skipOptimisticUpdate: true,
            traceId: traceIdBase,
          },
        }))
        logger.info(`initialized folder ${folder}`)
        updateProgress()
      }

      updateJob(jobId, { status: "succeeded", progress: 100 })

    } catch (error) {
      console.error(`[${traceIdBase}] Import media library failed:`, error)
      updateJob(jobId, { status: "failed" })
      debug(`failed to import media library: ${error instanceof Error ? error.message : String(error)}`)
      toast.error(
        error instanceof Error ? error.message : "导入媒体库失败",
      )
    }
  }

  useMount(() => {
    eventListener.current = (event) => {
      debug(`received ${UI_MediaLibraryImportedEvent} event`)
        ; (async () => {
          doImportMediaLibrary(event)
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

