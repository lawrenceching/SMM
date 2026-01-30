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
import type { UIMediaMetadata } from "@/types/UIMediaMetadata"
import { doPreprocessMediaFolder } from "@/AppV2Utils"
import { createInitialMediaMetadata } from "@/lib/mediaMetadataUtils"
import { isNotNil } from "es-toolkit"
import type { OnMediaFolderImportedEventData, UIEvent } from "@/types/EventHandlerTypes"

export function useInitializeMediaFolderEventHandler() {

  const { setMediaFolderStates } = useGlobalStates()
  const { addMediaFolderInUserConfig } = useConfig()
  const { addMediaMetadata, updateMediaMetadata } = useMediaMetadata()

  const onFolderImported = useCallback(async (event: UIEvent) => {
    const data = event.data as OnMediaFolderImportedEventData
    const { type, folderPathInPlatformFormat } = data
    const traceId = data.traceId || `useInitializeMediaFolderEventHandler-${nextTraceId()}`

    console.log(`[${traceId}] onFolderSelected: Adding folder ${folderPathInPlatformFormat} to user config`)
    addMediaFolderInUserConfig(traceId, folderPathInPlatformFormat)

    const mm = await createInitialMediaMetadata(folderPathInPlatformFormat, { traceId })

    console.log('[onFolderSelected] Folder type selected:', type, 'for path:', folderPathInPlatformFormat)
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
        const response = await readMediaMetadataApi(folderPathInPlatformFormat, signal)
        const metadata = response.data

        if (!metadata
          || (metadata.type === 'tvshow-folder' && metadata.tmdbTvShow === undefined)
          || (metadata.type === 'movie-folder' && metadata.tmdbMovie === undefined)

        ) {
          
          if(isNotNil(metadata)) {
            mm.type = metadata.type
          }
          
          addMediaMetadata(mm, { traceId })
          addMediaFolderInUserConfig(traceId, folderPathInPlatformFormat)

          pathKey = mm.mediaFolderPath as string
          loadingWasSet = true
          // TODO: deprecate the media folder state and use UIMediaMetadata
          setMediaFolderStates((prev) => ({
            ...prev,
            [pathKey!]: {
              loading: true
            }
          }))


          if (signal.aborted) {
            console.log('[onFolderSelected] Aborted after listFiles')
            return
          }

          try {
            
            updateMediaMetadata(mm.mediaFolderPath!, {
              ...mm,
              status: 'initializing',
            }, { traceId })
            // pass signal.aborted to doPreprocessMediaFolder
            await doPreprocessMediaFolder(mm, {
              traceId,
              onSuccess: (mm) => {
                updateMediaMetadata(mm.mediaFolderPath!, {
                  ...mm,
                  status: 'ok',
                }, { traceId })
              },
              onError: (error) => {
                console.error(`[${traceId}] Failed to preprocess media folder:`, error)
                updateMediaMetadata(mm.mediaFolderPath!, (mm: UIMediaMetadata) => {
                  return {
                    ...mm,
                    status: 'ok',
                  }
                }, { traceId })
              },
            })
          } catch (error) {
            console.error(`[${traceId}] Failed to preprocess media folder:`, error)
          } finally {
            // updateMediaMetadata(initialMetadata.mediaFolderPath!, (mm: UIMediaMetadata) => {
            //   return {
            //     ...mm,
            //     status: 'ok',
            //   }
            // }, { traceId })
          }
          
        } else {
          addMediaMetadata({
            ...metadata,
            status: 'ok',
          }, { traceId })
          console.log('[onFolderSelected] Metadata already exists, skipping recognition')
        }

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
  }, [addMediaFolderInUserConfig, addMediaMetadata, updateMediaMetadata, setMediaFolderStates])

  return onFolderImported
}
