import { useRef } from "react";
import { useMount, useUnmount } from "react-use";
import { useBackgroundJobsStore } from "@/stores/backgroundJobsStore";
import { useMediaMetadataStoreActions } from "@/stores/mediaMetadataStore";
import { useConfig } from "@/providers/config-provider";
import { useMediaMetadataActions } from "@/actions/mediaMetadataActions";
import { nextTraceId } from "@/lib/utils";
import { Path } from "@core/path";
import type { UIMediaMetadata } from "@/types/UIMediaMetadata"
import { doPreprocessMediaFolder } from "@/AppV2Utils"
import { delay } from "es-toolkit"
import { UI_MediaFolderImportedEvent, type OnMediaFolderImportedEventData } from "@/types/eventTypes";
import { initializeMusicFolder } from "@/lib/initializeMusicFolder";
import { Mutex } from "es-toolkit";
const mutex = new Mutex();

export function MediaFolderImportedEventHandler() {

    const { addMediaFolderInUserConfig } = useConfig()
    const { getMediaMetadata, setSelectedByMediaFolderPath } = useMediaMetadataStoreActions()
    const { saveMediaMetadata, updateMediaMetadata, initializeMediaMetadata } = useMediaMetadataActions();
    const backgroundJobs = useBackgroundJobsStore()
    const eventListener = useRef<((event: Event) => void) | null>(null);

    const doInitializeMediaFolder = async (event: Event) => {
        const data = (event as CustomEvent<OnMediaFolderImportedEventData>).detail
        const { type, folderPathInPlatformFormat } = data
        // Get or create traceId - we'll use the job ID as traceId
        const traceId = data.traceId || `useInitializeMediaFolderEventHandler-${nextTraceId()}`

        const updateSelectedMediaMetadata = async (mediaFolderPathInPosix: string) => {
            // Wait a bit for the metadata to be added to the store
            await delay(100);
            console.log(`[${traceId}] Auto-selecting newly imported folder: ${Path.toPlatformPath(mediaFolderPathInPosix)}`)
            setSelectedByMediaFolderPath(mediaFolderPathInPosix)
        }

        if (type === 'music') {
            await initializeMusicFolder(folderPathInPlatformFormat, {
                addMediaFolderInUserConfig,
                getMediaMetadata: (folderInPlatformPath: string) => {
                    return getMediaMetadata(Path.posix(folderInPlatformPath));
                },
                addMediaMetadata: saveMediaMetadata,
                traceId,
            });
            updateSelectedMediaMetadata(Path.posix(folderPathInPlatformFormat))
            return;
        }

        if (getMediaMetadata(Path.posix(folderPathInPlatformFormat))?.status === 'initializing') {
            console.log(`[${traceId}] onFolderSelected: Folder ${folderPathInPlatformFormat} is already initializing, skipping`)
            return
        }

        addMediaFolderInUserConfig(traceId, folderPathInPlatformFormat)

        // Create background job at the start of initialization
        let jobId: string | null = null
        jobId = backgroundJobs.addJob(`初始化 ${new Path(folderPathInPlatformFormat).name()}`)
        backgroundJobs.updateJob(jobId, {
            status: 'running',
            progress: 0,
        })

        const mediaType = type === 'tvshow' ? 'tvshow-folder' : 'movie-folder';

        console.log('[onFolderSelected] Folder type selected:', type, 'for path:', folderPathInPlatformFormat)
        console.log(`[${traceId}] onFolderSelected: Starting folder selection process`)
        const abortController = new AbortController()
        const signal = abortController.signal

        // Helper function to set job progress
        const setJobProgress = (progress: number) => {
            if (jobId) {
                backgroundJobs.updateJob(jobId, {
                    progress,
                })
            }
        }

        // Helper function to set job status
        const setJobStatus = (status: 'succeeded' | 'failed' | 'aborted') => {
            if (jobId) {
                backgroundJobs.updateJob(jobId, {
                    status,
                    progress: status === 'succeeded' ? 100 : undefined,
                })
            }
        }

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

                // Initialize metadata using the new unified API
                const initializedMetadata = await initializeMediaMetadata(folderPathInPlatformFormat, mediaType, { traceId });

                // Check if metadata needs further processing (e.g., TMDB enrichment)
                const isMetadataIncomplete = !initializedMetadata.tmdbTvShow && !initializedMetadata.tmdbMovie;

                if (isMetadataIncomplete) {
                    saveMediaMetadata(initializedMetadata, { traceId })
                    addMediaFolderInUserConfig(traceId, folderPathInPlatformFormat)

                    if (signal.aborted) {
                        console.log('[onFolderSelected] Aborted after initialization')
                        setJobStatus('aborted')
                        return
                    }

                    try {
                        // Update status to initializing
                        updateMediaMetadata(initializedMetadata.mediaFolderPath!, {
                            ...initializedMetadata,
                            status: 'initializing',
                        }, { traceId })

                        // TODO: pass signal.aborted to doPreprocessMediaFolder
                        await doPreprocessMediaFolder(initializedMetadata, {
                            traceId,
                            onSuccess: (processedMetadata) => {
                                updateMediaMetadata(processedMetadata.mediaFolderPath!, {
                                    ...processedMetadata,
                                    status: 'ok',
                                }, { traceId })
                                setJobStatus('succeeded')
                                // Auto-select the newly imported folder
                                updateSelectedMediaMetadata(processedMetadata.mediaFolderPath!)
                            },
                            onError: (error) => {
                                console.error(`[${traceId}] Failed to preprocess media folder:`, error)
                                updateMediaMetadata(initializedMetadata.mediaFolderPath!, (mm: UIMediaMetadata) => {
                                    return {
                                        ...mm,
                                        status: 'ok',
                                    }
                                }, { traceId })
                                setJobStatus('failed')
                                // Still auto-select the folder even if processing failed
                                updateSelectedMediaMetadata(initializedMetadata.mediaFolderPath!)
                            },
                        })

                    } catch (error) {
                        console.error(`[${traceId}] Failed to preprocess media folder:`, error)
                        setJobStatus('failed')
                    }

                } else {
                    // Metadata already complete
                    saveMediaMetadata({
                        ...initializedMetadata,
                        status: 'ok',
                    }, { traceId })
                    console.log('[onFolderSelected] Metadata already exists and is complete')
                    setJobStatus('succeeded')
                    // Auto-select the newly imported folder
                    updateSelectedMediaMetadata(initializedMetadata.mediaFolderPath!)
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
                    console.error('Failed to initialize media metadata:', error)
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
            // Note: updateSelectedMediaMetadata will be called by mainOperation when metadata is added
            await Promise.race([mainOperation(), timeoutPromise])
        } catch (error) {
            // Handle timeout or other errors
            if (error instanceof Error && error.message.includes('timed out')) {
                console.error('[onFolderSelected] Operation timed out after 10 seconds')
                setJobStatus('aborted')
            } else if (!signal.aborted) {
                console.error('[onFolderSelected] Failed to read media metadata:', error)
            }

        }
    }

    useMount(() => {

        eventListener.current = (event) => {
            console.log('Socket event:', (event as CustomEvent<OnMediaFolderImportedEventData>).detail);

            (async () => {

                try {
                    console.log(`acquiring mutex for media folder initialization`)
                    await mutex.acquire();
                    console.log(`acquired mutex for media folder initialization`)
                    await doInitializeMediaFolder(event)
                } catch (error) {
                    console.error('Failed to initialize media folder:', error)
                } finally {
                    mutex.release();
                    console.log(`released mutex for media folder initialization`)
                }



            })()

        };

        document.addEventListener(UI_MediaFolderImportedEvent, eventListener.current);

    })

    useUnmount(() => {

        if (eventListener.current) {
            document.removeEventListener(UI_MediaFolderImportedEvent, eventListener.current);
        }

    })

    return (
        <></>
    )
}