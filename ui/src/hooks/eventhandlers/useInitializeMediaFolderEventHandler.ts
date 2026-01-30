import { useCallback } from "react"
import { readMediaMetadataApi } from "@/api/readMediaMatadata"
import { useGlobalStates } from "@/providers/global-states-provider"
import { nextTraceId } from "@/lib/utils"
import { useConfig } from "@/providers/config-provider"
import { useMediaMetadata } from "@/providers/media-metadata-provider"
import type { UIMediaMetadata } from "@/types/UIMediaMetadata"
import { doPreprocessMediaFolder } from "@/AppV2Utils"
import { createInitialMediaMetadata } from "@/lib/mediaMetadataUtils"
import { isNotNil } from "es-toolkit"
import type { OnMediaFolderImportedEventData, UIEvent } from "@/types/EventHandlerTypes"
import { useBackgroundJobs } from "@/components/background-jobs/BackgroundJobsProvider"
import { Path } from "@core/path"

export function useInitializeMediaFolderEventHandler() {

  const { setMediaFolderStates } = useGlobalStates()
  const { addMediaFolderInUserConfig } = useConfig()
  const { addMediaMetadata, updateMediaMetadata } = useMediaMetadata()
  const backgroundJobs = useBackgroundJobs()

  const onFolderImported = useCallback(async (event: UIEvent) => {
    const data = event.data as OnMediaFolderImportedEventData
    const { type, folderPathInPlatformFormat } = data

    // Get or create traceId - we'll use the job ID as traceId
    const initialTraceId = data.traceId || `useInitializeMediaFolderEventHandler-${nextTraceId()}`

    // Create background job at the start of initialization
    let jobId: string | null = null
    jobId = backgroundJobs.addJob(`初始化 ${new Path(folderPathInPlatformFormat).name()}`)
    backgroundJobs.updateJob(jobId, {
      status: 'running',
      progress: 0,
    })

    const traceId = jobId || initialTraceId

    console.log(`[${traceId}] onFolderSelected: Adding folder ${folderPathInPlatformFormat} to user config`)
    addMediaFolderInUserConfig(traceId, folderPathInPlatformFormat)

    const mm = await createInitialMediaMetadata(folderPathInPlatformFormat, { traceId })

    console.log('[onFolderSelected] Folder type selected:', type, 'for path:', folderPathInPlatformFormat)
    console.log(`[${traceId}] onFolderSelected: Starting folder selection process`)
    const abortController = new AbortController()
    const signal = abortController.signal

    // Helper function to set job progress
    const setJobProgress = (progress: number) => {
      if (backgroundJobs && jobId) {
        backgroundJobs.updateJob(jobId, {
          progress,
        })
      }
    }

    // Helper function to set job status
    const setJobStatus = (status: 'succeeded' | 'failed' | 'aborted') => {
      if (backgroundJobs && jobId) {
        backgroundJobs.updateJob(jobId, {
          status,
          progress: status === 'succeeded' ? 100 : undefined,
        })
      }
    }

    // Helper function to set loading to false
    const setLoadingFalse = (pathKey: string) => {
      setMediaFolderStates((prev) => ({
        ...prev,
        [pathKey]: {
          loading: false
        }
      }))
    }

    // Track if we set loading to true (so we know to set it to false on timeout/error)
    let pathKey: string | null = null
    let loadingWasSet = false

    // Main operation promise
    const mainOperation = async () => {
      try {
        // Check if job was aborted before starting
        if (signal.aborted) {
          console.log('[onFolderSelected] Aborted before reading metadata')
          return
        }

        // Update progress to show job is running (50%)
        setJobProgress(50)

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
            setJobStatus('aborted')
            return
          }

          try {

            updateMediaMetadata(mm.mediaFolderPath!, {
              ...mm,
              status: 'initializing',
            }, { traceId })

            // TODO: pass signal.aborted to doPreprocessMediaFolder
            await doPreprocessMediaFolder(mm, {
              traceId,
              onSuccess: (mm) => {
                updateMediaMetadata(mm.mediaFolderPath!, {
                  ...mm,
                  status: 'ok',
                }, { traceId })
                setJobStatus('succeeded')
              },
              onError: (error) => {
                console.error(`[${traceId}] Failed to preprocess media folder:`, error)
                updateMediaMetadata(mm.mediaFolderPath!, (mm: UIMediaMetadata) => {
                  return {
                    ...mm,
                    status: 'ok',
                  }
                }, { traceId })
                setJobStatus('failed')
              },
            })

          } catch (error) {
            console.error(`[${traceId}] Failed to preprocess media folder:`, error)
            setJobStatus('failed')
          }

        } else {
          addMediaMetadata({
            ...metadata,
            status: 'ok',
          }, { traceId })
          console.log('[onFolderSelected] Metadata already exists, skipping recognition')
          // Job completes quickly when metadata already exists
          setJobStatus('succeeded')
        }

        if (signal.aborted) {
          console.log('[onFolderSelected] Aborted after adding folder to user config')
          setJobStatus('aborted')
          return
        }

      } catch (error) {
        console.log('[onFolderSelected] Error:', error)
        // Only log if not aborted (timeout errors are expected)
        if (!signal.aborted) {
          console.error('Failed to read media metadata:', error)
          setJobStatus('failed')
        }
        throw error
      }
    }

    // Race the main operation against the timeout (but timeout now just logs, doesn't force abort)
    const TIMEOUT_MS = 10000 // 10 seconds as advisory timeout

    // Create timeout promise for logging purposes only
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        console.log(`[${traceId}] Operation approaching timeout (${TIMEOUT_MS}ms)`)
        reject(new Error('Operation timed out after 10 seconds'))
      }, TIMEOUT_MS)
    })

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
        setJobStatus('aborted')
      } else if (!signal.aborted) {
        console.error('[onFolderSelected] Failed to read media metadata:', error)
      }

      // Set loading to false if we had set it to true
      if (loadingWasSet && pathKey) {
        setLoadingFalse(pathKey)
      }
    }
  }, [addMediaFolderInUserConfig, addMediaMetadata, updateMediaMetadata, setMediaFolderStates, backgroundJobs])

  return onFolderImported
}
