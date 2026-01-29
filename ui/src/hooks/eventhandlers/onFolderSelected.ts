import { useCallback } from "react"
import { readMediaMetadataApi } from "@/api/readMediaMatadata"
import { listFiles } from "@/api/listFiles"
import { tryToRecognizeMediaFolderByNFO } from "@/components/TvShowPanelUtils"
import { Path } from "@core/path"
import type { MediaMetadata } from "@core/types"
import type { FolderType } from "@/providers/dialog-provider"
import { getTvShowById } from "@/api/tmdb"
import { useGlobalStates } from "@/providers/global-states-provider"
import { nextTraceId } from "@/lib/utils"
import { useConfig } from "@/providers/config-provider"
import { useMediaMetadata } from "@/providers/media-metadata-provider"


async function refreshMediaMetadata(mm: MediaMetadata, updateMediaMetadata: (path: string, metadata: MediaMetadata, options?: { traceId?: string }) => void, signal?: AbortSignal) {
  const tmdbId = mm.tmdbTvShow?.id;
  if (tmdbId === undefined) {
    console.error('[onFolderSelected] Failed to refresh media metadata, tmdbId is undefined')
    return;
  }

  // TODO: set media language
  const response = await getTvShowById(tmdbId, 'zh-CN', signal);
  if (response.error) {
    console.error("[onFolderSelected] Failed to get TV show details:", response.error)
    return
  }

  if (!response.data) {
    console.error("[onFolderSelected] No TV show data returned")
    return
  }

  if (signal?.aborted) {
    return
  }

  const traceId = `refreshMediaMetadata-${nextTraceId()}`
  console.log(`[${traceId}] refreshMediaMetadata: Refreshing metadata for ${mm.mediaFolderPath}`)
  updateMediaMetadata(mm.mediaFolderPath!, {
    ...mm,
    tmdbTvShow: response.data,
    tmdbMediaType: 'tv',
    type: 'tvshow-folder',
  }, { traceId })

}

export function useOnFolderSelected(_addMediaMetadata: (metadata: MediaMetadata, options: { traceId: string }) => void, updateMediaMetadata: (path: string, metadata: MediaMetadata, options?: { traceId?: string }) => void) {

  const { setMediaFolderStates } = useGlobalStates()
  const { addMediaFolderInUserConfig } = useConfig()
  const { addMediaMetadata } = useMediaMetadata()

  const onFolderSelected = useCallback(async (type: FolderType, folderPath: string, options?: { traceId?: string }) => {
    const traceId = options?.traceId || `onFolderSelected-${nextTraceId()}`

    console.log('[onFolderSelected] Folder type selected:', type, 'for path:', folderPath)
    console.log(`[${traceId}] onFolderSelected: Starting folder selection process`)
    const abortController = new AbortController()
    const signal = abortController.signal
    const TIMEOUT_MS = 10000 // 10 seconds

    // Helper function to set loading to false
    const setLoadingFalse = (pathKey: string) => {
      setMediaFolderStates((prev) => ({
        ...prev,
        [pathKey]: {
          loading: false
        }
      }))
    }

    // Create timeout promise
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        abortController.abort()
        reject(new Error('Operation timed out after 10 seconds'))
      }, TIMEOUT_MS)
    })

    // Track if we set loading to true (so we know to set it to false on timeout/error)
    let pathKey: string | null = null
    let loadingWasSet = false

    // Main operation promise
    const mainOperation = async () => {
      try {
        const response = await readMediaMetadataApi(folderPath, signal)
        const metadata = response.data

        if (!metadata) {
          const initialMetadata: MediaMetadata = {
            mediaFolderPath: Path.posix(folderPath),
            type: type === "tvshow" ? "tvshow-folder" : type === "movie" ? "movie-folder" : "music-folder",
          }

          console.log('[onFolderSelected] Adding initial metadata:', initialMetadata)
          addMediaMetadata(initialMetadata, { traceId })

          pathKey = initialMetadata.mediaFolderPath as string
          loadingWasSet = true
          setMediaFolderStates((prev) => ({
            ...prev,
            [pathKey!]: {
              loading: true
            }
          }))

          const resp = await listFiles({
            path: folderPath,
            recursively: true,
            onlyFiles: true,
          }, signal)

          if (signal.aborted) {
            console.log('[onFolderSelected] Aborted after listFiles')
            return
          }

          if (resp.error) {
            console.error('[onFolderSelected] Failed to list files:', resp.error)
            return;
          }

          if (resp.data === undefined) {
            console.error('[onFolderSelected] Failed to list files:', resp)
            return;
          }

          initialMetadata.files = resp.data.items.map(item => Path.posix(item.path))

          const recognizedMetadata = await tryToRecognizeMediaFolderByNFO(initialMetadata, signal)

          if (signal.aborted) {
            console.log('[onFolderSelected] Aborted after tryToRecognizeMediaFolderByNFO')
            return
          }

          if (recognizedMetadata === undefined) {
            console.log('[onFolderSelected] No recognized metadata, adding initial metadata')
            addMediaMetadata(initialMetadata, { traceId })
            console.log(`[${traceId}] onFolderSelected: Adding initial metadata to user config`)
            addMediaFolderInUserConfig(traceId, folderPath)
            return;
          }

          if (signal.aborted) {
            console.log('[onFolderSelected] Aborted after addMediaMetadata')
            return
          }

          console.log('[onFolderSelected] Adding recognized metadata:', recognizedMetadata)
          await addMediaMetadata(recognizedMetadata, { traceId })
          console.log('[onFolderSelected] Refreshing media metadata:', recognizedMetadata)
          await refreshMediaMetadata(recognizedMetadata, updateMediaMetadata, signal)
          console.log(`[${traceId}] onFolderSelected: Adding recognized metadata to user config`)
          addMediaFolderInUserConfig(traceId, folderPath)

          if (signal.aborted) {
            console.log('[onFolderSelected] Aborted after refreshMediaMetadata')
            return
          }

          return;
        } else {
        console.log('[onFolderSelected] Metadata already exists, skipping recognition')
      }

      console.log(`[${traceId}] onFolderSelected: Adding folder to user config`)
      addMediaFolderInUserConfig(traceId, folderPath)

        if (signal.aborted) {
          console.log('[onFolderSelected] Aborted after adding folder to user config')
          return
        }


      } catch (error) {
        console.log('[onFolderSelected] Error:', error)
        // Only log if not aborted (timeout errors are expected)
        if (!signal.aborted) {
          console.error('Failed to read media metadata:', error)
        }
        throw error
      }
    }

    // Race the main operation against the timeout
    try {
      await Promise.race([mainOperation(), timeoutPromise])

      // If we successfully completed and set loading, set it to false
      if (loadingWasSet && pathKey && !signal.aborted) {
        setLoadingFalse(pathKey)
      }
    } catch (error) {
      // Handle timeout or other errors
      if (error instanceof Error && error.message.includes('timed out')) {
        console.error('[onFolderSelected] Operation timed out after 10 seconds')
      } else if (!signal.aborted) {
        console.error('[onFolderSelected] Failed to read media metadata:', error)
      }

      // Set loading to false if we had set it to true
      if (loadingWasSet && pathKey) {
        setLoadingFalse(pathKey)
      }
    }
  }, [addMediaMetadata, updateMediaMetadata, setMediaFolderStates])

  return onFolderSelected
}
