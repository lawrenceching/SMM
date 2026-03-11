import { Path } from "@core/path"
import type { UIMediaMetadata } from "@/types/UIMediaMetadata"
import { doPreprocessMediaFolder } from "@/AppV2Utils"
import { initializeMusicFolder } from "@/lib/initializeMusicFolder"

export type FolderType = "tvshow" | "movie" | "music"

export interface InitializeSingleMediaFolderDeps {
  addMediaFolderInUserConfig: (traceId: string, folder: string) => Promise<void>
  getMediaMetadata: (path: string) => UIMediaMetadata | undefined
  saveMediaMetadata: (metadata: UIMediaMetadata, opts?: { traceId?: string }) => Promise<void>
  updateMediaMetadata: (
    path: string,
    updaterOrMetadata: UIMediaMetadata | ((current: UIMediaMetadata) => UIMediaMetadata),
    opts?: { traceId?: string }
  ) => Promise<void>
  initializeMediaMetadata: (
    folderPathInPlatformFormat: string,
    type: "tvshow-folder" | "movie-folder" | "music-folder",
    opts?: { traceId?: string }
  ) => Promise<UIMediaMetadata>
}

export interface InitializeSingleMediaFolderOptions {
  onError?: (message: string) => void
}

/**
 * Initialize a single media folder (tvshow, movie, or music).
 * Does not add placeholder or change selection; caller is responsible for store/UI.
 * Used by MediaLibraryImportedEventHandler so it does not go through
 * MediaFolderImportedEventHandler (which would skip when placeholder is already "initializing").
 */
export async function initializeSingleMediaFolder(
  folderPathInPlatformFormat: string,
  type: FolderType,
  traceId: string,
  deps: InitializeSingleMediaFolderDeps,
  options?: InitializeSingleMediaFolderOptions
): Promise<void> {
  const { addMediaFolderInUserConfig, getMediaMetadata, saveMediaMetadata, updateMediaMetadata, initializeMediaMetadata } = deps
  const onError = options?.onError
  const pathPosix = Path.posix(folderPathInPlatformFormat)

  const setStatusToOk = async () => {
    const current = deps.getMediaMetadata(pathPosix)
    if (current) {
      await updateMediaMetadata(pathPosix, (m) => ({ ...m, status: "ok" as const }), { traceId })
    }
  }

  if (type === "music") {
    await addMediaFolderInUserConfig(traceId, folderPathInPlatformFormat)
    try {
      await initializeMusicFolder(folderPathInPlatformFormat, {
        addMediaFolderInUserConfig,
        getMediaMetadata: (folderInPlatformPath: string) => getMediaMetadata(Path.posix(folderInPlatformPath)),
        addMediaMetadata: saveMediaMetadata,
        traceId,
      })
    } catch (error) {
      const folderName = new Path(folderPathInPlatformFormat).name()
      const message = `导入音乐目录失败: ${folderName}. ${error instanceof Error ? error.message : String(error)}`
      onError?.(message)
      await setStatusToOk()
      throw error
    }
    return
  }

  const mediaType = type === "tvshow" ? "tvshow-folder" : "movie-folder"
  await addMediaFolderInUserConfig(traceId, folderPathInPlatformFormat)

  let initializedMetadata: UIMediaMetadata
  try {
    initializedMetadata = await initializeMediaMetadata(folderPathInPlatformFormat, mediaType, { traceId })
  } catch (error) {
    const folderName = new Path(folderPathInPlatformFormat).name()
    const message = `初始化媒体目录失败: ${folderName}. ${error instanceof Error ? error.message : String(error)}`
    onError?.(message)
    await setStatusToOk()
    throw error
  }

  const isMetadataIncomplete = !initializedMetadata.tmdbTvShow && !initializedMetadata.tmdbMovie

  if (isMetadataIncomplete) {
    await saveMediaMetadata(initializedMetadata, { traceId })
    await addMediaFolderInUserConfig(traceId, folderPathInPlatformFormat)

    try {
      await updateMediaMetadata(initializedMetadata.mediaFolderPath!, { ...initializedMetadata, status: "initializing" }, { traceId })

      await doPreprocessMediaFolder(initializedMetadata, {
        traceId,
        onSuccess: (processedMetadata) => {
          void updateMediaMetadata(processedMetadata.mediaFolderPath!, { ...processedMetadata, status: "ok" }, { traceId })
        },
        onError: (error) => {
          console.error(`[${traceId}] Failed to preprocess media folder:`, error)
          const folderName = new Path(folderPathInPlatformFormat).name()
          onError?.(`预处理媒体目录失败: ${folderName}. ${error instanceof Error ? error.message : String(error)}`)
          void updateMediaMetadata(initializedMetadata.mediaFolderPath!, (mm: UIMediaMetadata) => ({ ...mm, status: "ok" }), { traceId })
        },
      })
    } catch (error) {
      const folderName = new Path(folderPathInPlatformFormat).name()
      onError?.(`预处理媒体目录失败: ${folderName}. ${error instanceof Error ? error.message : String(error)}`)
      await setStatusToOk()
      throw error
    }
  } else {
    await saveMediaMetadata({ ...initializedMetadata, status: "ok" }, { traceId })
  }
}
