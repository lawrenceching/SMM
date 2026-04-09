import { useRef } from "react";
import { useLatest, useMount, useUnmount } from "react-use";
import { useBackgroundJobsStore } from "@/stores/backgroundJobsStore";
import { useMediaMetadataStore, useMediaMetadataStoreActions } from "@/stores/mediaMetadataStore";
import { useConfig } from "@/providers/config-provider";
import { useMediaMetadataActions } from "@/actions/mediaMetadataActions";
import { nextTraceId } from "@/lib/utils";
import { Path } from "@core/path";
import { createMediaMetadata } from "@core/mediaMetadata";
import type { UIMediaMetadata } from "@/types/UIMediaMetadata"
import { UI_MediaFolderImportedEvent, type OnMediaFolderImportedEventData } from "@/types/eventTypes";
import { initializeMusicFolder } from "@/lib/initializeMusicFolder";
import { Mutex } from "es-toolkit";
import { toast } from "sonner";
import {
    runRecognitionSteps,
    searchOrderForPrimaryDb,
    type RecognitionStep,
} from "@/lib/mediaFolderRecognitionPipeline";
import { useRecognizeTvShowByNfoMutation } from "@/hooks/initialization/useRecognizeTvShowByNfoMutation";
import { useRecognizeTvShowBySearchingFolderNameInTvdb } from "@/hooks/initialization/useRecognizeTvShowBySearchingFolderNameInTvdb";
import { useRecognizeTvShowBySearchingFolderNameInTmdb } from "@/hooks/initialization/useRecognizeTvShowBySearchingFolderNameInTmdb";
import { useRecognizeTvShowByTmdbIdInFolderNameMutation } from "@/hooks/initialization/useRecognizeTvShowByTmdbIdInFolderNameMutation";
import { useRecognizeTvShowByTvdbIdInFolderNameMutation } from "@/hooks/initialization/useRecognizeTvShowByTvdbIdInFolderNameMutation";

import { useRecognizeMovieByNfoMutation } from "@/hooks/initialization/useRecognizeMovieByNfoMutation";
import { useRecognizeMovieBySearchingFolderNameInTvdb } from "@/hooks/initialization/useRecognizeMovieBySearchingFolderNameInTvdb";
import { useRecognizeMovieBySearchingFolderNameInTmdb } from "@/hooks/initialization/useRecognizeMovieBySearchingFolderNameInTmdb";
import { useRecognizeMovieByTmdbIdInFolderNameMutation } from "@/hooks/initialization/useRecognizeMovieByTmdbIdInFolderNameMutation";
import { useRecognizeMovieByTvdbIdInFolderNameMutation } from "@/hooks/initialization/useRecognizeMovieByTvdbIdInFolderNameMutation";
import { recognizeEpisodes } from "@/lib/recognizeEpisodes";
import type { MediaFileMetadata } from "@core/types";

const mutex = new Mutex();

export function MediaFolderImportedEventHandler() {

    const { addMediaFolderInUserConfig, userConfig } = useConfig()
    const latestUserConfig = useLatest(userConfig)
    const { getMediaMetadata, setSelectedByMediaFolderPath, addMediaMetadata } = useMediaMetadataStoreActions()
    const { saveMediaMetadata, updateMediaMetadata, initializeMediaMetadata } = useMediaMetadataActions();
    const backgroundJobs = useBackgroundJobsStore()
    const eventListener = useRef<((event: Event) => void) | null>(null);
    const { mutateAsync: recognizeTvShowByNfo } = useRecognizeTvShowByNfoMutation()
    const { mutateAsync: recognizeTvShowByTmdbIdInFolderName } = useRecognizeTvShowByTmdbIdInFolderNameMutation()
    const { mutateAsync: recognizeTvShowByTvdbIdInFolderName } = useRecognizeTvShowByTvdbIdInFolderNameMutation()
    const { mutateAsync: recognizeTvShowBySearchTvShowFolderNameInTmdb } = useRecognizeTvShowBySearchingFolderNameInTmdb()
    const { mutateAsync: recognizeTvShowBySearchTvShowFolderNameInTvdb } = useRecognizeTvShowBySearchingFolderNameInTvdb()

    const { mutateAsync: recognizeMovieByNfo } = useRecognizeMovieByNfoMutation()
    const { mutateAsync: recognizeMovieByTmdbIdInFolderName } = useRecognizeMovieByTmdbIdInFolderNameMutation()
    const { mutateAsync: recognizeMovieByTvdbIdInFolderName } = useRecognizeMovieByTvdbIdInFolderNameMutation()
    const { mutateAsync: recognizeMovieBySearchFolderNameInTmdb } = useRecognizeMovieBySearchingFolderNameInTmdb()
    const { mutateAsync: recognizeMovieBySearchFolderNameInTvdb } = useRecognizeMovieBySearchingFolderNameInTvdb()

    const doInitializeMediaFolder = async (event: Event) => {
        const data = (event as CustomEvent<OnMediaFolderImportedEventData>).detail
        const { type, folderPathInPlatformFormat } = data
        const shouldSkipOptimisticUpdate = Boolean(data.skipOptimisticUpdate)
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
            if (!shouldSkipOptimisticUpdate) {
                const placeholder: UIMediaMetadata = {
                    ...createMediaMetadata(folderPathInPlatformFormat, 'music-folder'),
                    status: 'initializing',
                }
                addMediaMetadata(placeholder)
                setSelectedByMediaFolderPath(optimisticTargetPath)
            }

            try {
                await initializeMusicFolder(folderPathInPlatformFormat, {
                    addMediaFolderInUserConfig,
                    getMediaMetadata: (folderInPlatformPath: string) => {
                        return getMediaMetadata(Path.posix(folderInPlatformPath));
                    },
                    addMediaMetadata: saveMediaMetadata,
                    updateMediaMetadata: (path, metadata) =>
                        updateMediaMetadata(path, metadata, { traceId }),
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
        if (!shouldSkipOptimisticUpdate) {
            const placeholder: UIMediaMetadata = {
                ...createMediaMetadata(folderPathInPlatformFormat, mediaType),
                status: 'initializing',
            }
            addMediaMetadata(placeholder)
            setSelectedByMediaFolderPath(optimisticTargetPath)
        }

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

                const isMetadataIncomplete =
                    !initializedMetadata.tvShow &&
                    !initializedMetadata.movie;

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

                        if (initializedMetadata.type === 'tvshow-folder') {
                            const recognitionLanguage =
                                latestUserConfig.current.preferMediaLanguage ?? "en-US"
                            const searchOrder = searchOrderForPrimaryDb(latestUserConfig.current.primaryDatabase)
                            const tvSteps: RecognitionStep<Awaited<ReturnType<typeof recognizeTvShowByNfo>>>[] = [
                                {
                                    logLabel: 'tvshow.nfo',
                                    tryRecognize: () =>
                                        recognizeTvShowByNfo({
                                            mediaMetadata: initializedMetadata,
                                            language: recognitionLanguage,
                                        }),
                                },
                                {
                                    logLabel: 'tmdbid in folder name',
                                    tryRecognize: () =>
                                        recognizeTvShowByTmdbIdInFolderName({
                                            mediaMetadata: initializedMetadata,
                                            language: recognitionLanguage,
                                        }),
                                },
                                {
                                    logLabel: 'tvdbid in folder name',
                                    tryRecognize: () =>
                                        recognizeTvShowByTvdbIdInFolderName({
                                            mediaMetadata: initializedMetadata,
                                            language: recognitionLanguage,
                                        }),
                                },
                                ...searchOrder.map((db) => ({
                                    logLabel:
                                        db === 'TMDB'
                                            ? 'searching folder name in TMDB'
                                            : 'searching folder name in TVDB',
                                    tryRecognize: () =>
                                        db === 'TMDB'
                                            ? recognizeTvShowBySearchTvShowFolderNameInTmdb({
                                                  mediaMetadata: initializedMetadata,
                                                  language: recognitionLanguage,
                                              })
                                            : recognizeTvShowBySearchTvShowFolderNameInTvdb({
                                                  mediaMetadata: initializedMetadata,
                                                  language: recognitionLanguage,
                                              }),
                                })),
                            ]
                            const recognized = await runRecognitionSteps(
                                traceId,
                                initializedMetadata,
                                tvSteps,
                                (tvShow) => ({ ...initializedMetadata, tvShow, status: 'ok' }),
                                updateMediaMetadata
                            )
                            if (recognized) {

                                console.log(`media folder was recognized, try to recognize episodes`)

                                const latestMM: UIMediaMetadata | undefined = getMediaMetadata(initializedMetadata.mediaFolderPath!)

                                if(latestMM === undefined) {
                                    console.warn(`[${traceId}] unable to find UIMediaMetadata after recognizing media folder`)
                                    setJobStatus('failed')
                                    return
                                }

                                const mmWithRecognizedEpisodes = await recognizeEpisodes(latestMM)
                                if(mmWithRecognizedEpisodes) {
                                    const mediaFiles: MediaFileMetadata[] = mmWithRecognizedEpisodes.map((i) => ({
                                        absolutePath: i.file,
                                        seasonNumber: i.season,
                                        episodeNumber: i.episode,
                                    }))
                                    updateMediaMetadata(
                                        initializedMetadata.mediaFolderPath!, 
                                        (prev) => {
                                            return {
                                                ...prev,
                                                mediaFiles: mediaFiles,
                                                status: 'ok',
                                            }
                                        }, { traceId })
                                } else {
                                    console.warn(`[${traceId}] unable to recognize episodes after recognizing media folder`)
                                }
                                setJobStatus('succeeded')
                                return
                            }
                        } else if (initializedMetadata.type === 'movie-folder') {
                            const recognitionLanguage =
                                latestUserConfig.current.preferMediaLanguage ?? "en-US"
                            const searchOrder = searchOrderForPrimaryDb(latestUserConfig.current.primaryDatabase)
                            const movieSteps: RecognitionStep<Awaited<ReturnType<typeof recognizeMovieByNfo>>>[] = [
                                {
                                    logLabel: 'movie.nfo',
                                    tryRecognize: () =>
                                        recognizeMovieByNfo({
                                            mediaMetadata: initializedMetadata,
                                            language: recognitionLanguage,
                                        }),
                                },
                                {
                                    logLabel: 'tmdbid in folder name',
                                    tryRecognize: () =>
                                        recognizeMovieByTmdbIdInFolderName({
                                            mediaMetadata: initializedMetadata,
                                            language: recognitionLanguage,
                                        }),
                                },
                                {
                                    logLabel: 'tvdbid in folder name',
                                    tryRecognize: () =>
                                        recognizeMovieByTvdbIdInFolderName({
                                            mediaMetadata: initializedMetadata,
                                            language: recognitionLanguage,
                                        }),
                                },
                                ...searchOrder.map((db) => ({
                                    logLabel:
                                        db === 'TMDB'
                                            ? 'searching folder name in TMDB'
                                            : 'searching folder name in TVDB',
                                    tryRecognize: () =>
                                        db === 'TMDB'
                                            ? recognizeMovieBySearchFolderNameInTmdb({
                                                  mediaMetadata: initializedMetadata,
                                                  language: recognitionLanguage,
                                              })
                                            : recognizeMovieBySearchFolderNameInTvdb({
                                                  mediaMetadata: initializedMetadata,
                                                  language: recognitionLanguage,
                                              }),
                                })),
                            ]
                            const recognized = await runRecognitionSteps(
                                traceId,
                                initializedMetadata,
                                movieSteps,
                                (movie) => ({ ...initializedMetadata, movie, status: 'ok' }),
                                updateMediaMetadata
                            )
                            if (recognized) {
                                return
                            }
                        } else {
                            console.log(`[${traceId}] folder of type ${initializedMetadata.type} does not need to be initialized`)
                        }

                        

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

        const TIMEOUT_MS = 60000
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
                    const data = (event as CustomEvent<OnMediaFolderImportedEventData>).detail
                    data.onCompleted?.()
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
