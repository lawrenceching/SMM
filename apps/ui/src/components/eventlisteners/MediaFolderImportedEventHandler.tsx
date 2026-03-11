import { useRef } from "react";
import { useMount, useUnmount } from "react-use";
import { useBackgroundJobsStore } from "@/stores/backgroundJobsStore";
import { useMediaMetadataStore, useMediaMetadataStoreActions } from "@/stores/mediaMetadataStore";
import { useConfig } from "@/providers/config-provider";
import { useMediaMetadataActions } from "@/actions/mediaMetadataActions";
import { nextTraceId } from "@/lib/utils";
import { Path } from "@core/path";
import { createMediaMetadata } from "@core/mediaMetadata";
import type { UIMediaMetadata } from "@/types/UIMediaMetadata"
import { doPreprocessMediaFolder } from "@/AppV2Utils"
import { UI_MediaFolderImportedEvent, type OnMediaFolderImportedEventData } from "@/types/eventTypes";
import { initializeMusicFolder } from "@/lib/initializeMusicFolder";
import { Mutex } from "es-toolkit";
import { toast } from "sonner";

const mutex = new Mutex();

export function MediaFolderImportedEventHandler() {

    const { addMediaFolderInUserConfig } = useConfig()
    const { getMediaMetadata, setSelectedByMediaFolderPath, addMediaMetadata } = useMediaMetadataStoreActions()
    const { saveMediaMetadata, updateMediaMetadata, initializeMediaMetadata } = useMediaMetadataActions();
    const backgroundJobs = useBackgroundJobsStore()
    const eventListener = useRef<((event: Event) => void) | null>(null);

    const doInitializeMediaFolder = async (event: Event) => {
        const data = (event as CustomEvent<OnMediaFolderImportedEventData>).detail
        const { type, folderPathInPlatformFormat } = data
        const traceId = data.traceId || `useInitializeMediaFolderEventHandler-${nextTraceId()}`
        const targetPathPosix = Path.posix(folderPathInPlatformFormat)

        // Capture previous selection for rollback (read at handler run time)
        const storeState = useMediaMetadataStore.getState()
        const previousSelectedPath: string | undefined = storeState.mediaMetadatas[storeState.selectedIndex]?.mediaFolderPath

        const optimisticTargetPath = targetPathPosix

        const rollbackSelection = (removePlaceholder = false) => {
            const state = useMediaMetadataStore.getState()
            const currentPath = state.mediaMetadatas[state.selectedIndex]?.mediaFolderPath
            if (currentPath === optimisticTargetPath) {
                if (previousSelectedPath) {
                    state.setSelectedByMediaFolderPath(previousSelectedPath)
                }
            }
            if (removePlaceholder) {
                state.removeMediaMetadata(optimisticTargetPath)
            }
        }

        const showErrorAndRollback = (message: string, removePlaceholder = false) => {
            toast.error(message)
            rollbackSelection(removePlaceholder)
        }

        if (type === 'music') {
            const placeholder: UIMediaMetadata = {
                ...createMediaMetadata(folderPathInPlatformFormat, 'music-folder'),
                status: 'initializing',
            }
            addMediaMetadata(placeholder)
            setSelectedByMediaFolderPath(optimisticTargetPath)

            try {
                await initializeMusicFolder(folderPathInPlatformFormat, {
                    addMediaFolderInUserConfig,
                    getMediaMetadata: (folderInPlatformPath: string) => {
                        return getMediaMetadata(Path.posix(folderInPlatformPath));
                    },
                    addMediaMetadata: saveMediaMetadata,
                    traceId,
                });
            } catch (error) {
                const folderName = new Path(folderPathInPlatformFormat).name()
                showErrorAndRollback(
                    `导入音乐目录失败: ${folderName}. ${error instanceof Error ? error.message : String(error)}`,
                    true
                )
            }
            return
        }

        if (getMediaMetadata(targetPathPosix)?.status === 'initializing') {
            console.log(`[${traceId}] onFolderSelected: Folder ${folderPathInPlatformFormat} is already initializing, skipping`)
            return
        }

        addMediaFolderInUserConfig(traceId, folderPathInPlatformFormat)

        const mediaType = type === 'tvshow' ? 'tvshow-folder' : 'movie-folder'
        const placeholder: UIMediaMetadata = {
            ...createMediaMetadata(folderPathInPlatformFormat, mediaType),
            status: 'initializing',
        }
        addMediaMetadata(placeholder)
        setSelectedByMediaFolderPath(optimisticTargetPath)

        let jobId: string | null = null
        jobId = backgroundJobs.addJob(`初始化 ${new Path(folderPathInPlatformFormat).name()}`)
        backgroundJobs.updateJob(jobId, {
            status: 'running',
            progress: 0,
        })

        console.log('[onFolderSelected] Folder type selected:', type, 'for path:', folderPathInPlatformFormat)
        console.log(`[${traceId}] onFolderSelected: Starting folder selection process`)
        const abortController = new AbortController()
        const signal = abortController.signal

        const setJobProgress = (progress: number) => {
            if (jobId) {
                backgroundJobs.updateJob(jobId, { progress })
            }
        }

        const setJobStatus = (status: 'succeeded' | 'failed' | 'aborted') => {
            if (jobId) {
                backgroundJobs.updateJob(jobId, {
                    status,
                    progress: status === 'succeeded' ? 100 : undefined,
                })
            }
        }

        const mainOperation = async () => {
            try {
                if (signal.aborted) {
                    console.log('[onFolderSelected] Aborted before reading metadata')
                    return
                }

                setJobProgress(50)

                let initializedMetadata: UIMediaMetadata
                try {
                    initializedMetadata = await initializeMediaMetadata(folderPathInPlatformFormat, mediaType, { traceId });
                } catch (error) {
                    console.error('Failed to initialize media metadata:', error)
                    setJobStatus('failed')
                    const folderName = new Path(folderPathInPlatformFormat).name()
                    showErrorAndRollback(
                        `初始化媒体目录失败: ${folderName}. ${error instanceof Error ? error.message : String(error)}`,
                        true
                    )
                    return
                }

                const isMetadataIncomplete = !initializedMetadata.tmdbTvShow && !initializedMetadata.tmdbMovie;

                if (isMetadataIncomplete) {
                    saveMediaMetadata(initializedMetadata, { traceId })
                    addMediaFolderInUserConfig(traceId, folderPathInPlatformFormat)

                    if (signal.aborted) {
                        console.log('[onFolderSelected] Aborted after initialization')
                        setJobStatus('aborted')
                        showErrorAndRollback('导入已取消', false)
                        return
                    }

                    try {
                        updateMediaMetadata(initializedMetadata.mediaFolderPath!, {
                            ...initializedMetadata,
                            status: 'initializing',
                        }, { traceId })

                        await doPreprocessMediaFolder(initializedMetadata, {
                            traceId,
                            onSuccess: (processedMetadata) => {
                                updateMediaMetadata(processedMetadata.mediaFolderPath!, {
                                    ...processedMetadata,
                                    status: 'ok',
                                }, { traceId })
                                setJobStatus('succeeded')
                            },
                            onError: (error) => {
                                console.error(`[${traceId}] Failed to preprocess media folder:`, error)
                                updateMediaMetadata(initializedMetadata.mediaFolderPath!, (mm: UIMediaMetadata) => ({
                                    ...mm,
                                    status: 'ok',
                                }), { traceId })
                                setJobStatus('failed')
                                const folderName = new Path(folderPathInPlatformFormat).name()
                                showErrorAndRollback(
                                    `预处理媒体目录失败: ${folderName}. ${error instanceof Error ? error.message : String(error)}`,
                                    false
                                )
                            },
                        })
                    } catch (error) {
                        console.error(`[${traceId}] Failed to preprocess media folder:`, error)
                        setJobStatus('failed')
                        const folderName = new Path(folderPathInPlatformFormat).name()
                        showErrorAndRollback(
                            `预处理媒体目录失败: ${folderName}. ${error instanceof Error ? error.message : String(error)}`,
                            false
                        )
                    }

                } else {
                    saveMediaMetadata({
                        ...initializedMetadata,
                        status: 'ok',
                    }, { traceId })
                    console.log('[onFolderSelected] Metadata already exists and is complete')
                    setJobStatus('succeeded')
                }

                if (signal.aborted) {
                    console.log('[onFolderSelected] Aborted after adding folder to user config')
                    setJobStatus('aborted')
                    showErrorAndRollback('导入已取消', false)
                    return
                }

            } catch (error) {
                console.log('[onFolderSelected] Error:', error)
                if (!signal.aborted) {
                    console.error('Failed to initialize media metadata:', error)
                    setJobStatus('failed')
                }
                throw error
            }
        }

        const TIMEOUT_MS = 10000
        const timeoutPromise = new Promise<never>((_, reject) => {
            setTimeout(() => {
                console.log(`[${traceId}] Operation approaching timeout (${TIMEOUT_MS}ms)`)
                reject(new Error('Operation timed out after 10 seconds'))
            }, TIMEOUT_MS)
        })

        try {
            await Promise.race([mainOperation(), timeoutPromise])
        } catch (error) {
            if (error instanceof Error && error.message.includes('timed out')) {
                console.error('[onFolderSelected] Operation timed out after 10 seconds')
                setJobStatus('aborted')
                const folderName = new Path(folderPathInPlatformFormat).name()
                showErrorAndRollback(`导入超时: ${folderName}`, false)
            } else if (!signal.aborted) {
                console.error('[onFolderSelected] Failed to read media metadata:', error)
                const folderName = new Path(folderPathInPlatformFormat).name()
                showErrorAndRollback(
                    `导入媒体目录失败: ${folderName}. ${error instanceof Error ? error.message : String(error)}`,
                    true
                )
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