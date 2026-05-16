import { useLatest } from "react-use";
import { useJobManager } from "@/hooks/useJobManager";
import { useConfig } from "@/hooks/userConfig";
import { nextTraceId } from "@/lib/utils";
import { Path } from "@core/path";
import type { OnMediaFolderImportedEventData } from "@/types/eventTypes";
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
import { recognizeEpisodes as recognizeEpisodesAsync } from "@/lib/recognizeEpisodes";
import { extname } from "@/lib/path";
import { videoFileExtensions } from "@core/utils";
import type { MediaFileMetadata, MediaMetadata, MovieMediaMetadata, TvShowMediaMetadata } from "@core/types";
import { withTimeout } from "es-toolkit";
import { logger } from "@/lib/log";
import { useCallback, useRef } from "react";
import type { FolderType } from "@core/types";
import { useInitializeMediaMetadataMutation, useUpdateMediaMetadataMutation } from "../mediaMetadata";
import { useUIMediaFolderStore } from "@/stores/uiMediaFolderStore";

export function useInitializeImportedMediaFolder() {

    const upsertFolder = useUIMediaFolderStore(state => state.upsertFolder)
    const setSelectedFolder = useUIMediaFolderStore(state => state.setSelectedFolder)
    const folders = useUIMediaFolderStore(state => state.folders)
    const latestFolders = useLatest(folders);
    const { addMediaFolderInUserConfig, userConfig, appConfig } = useConfig();
    const latestUserConfig = useLatest(userConfig);

    const { saveMediaMetadata } = useUpdateMediaMetadataMutation()
    const { mutateAsync: initializeMediaMetadata } = useInitializeMediaMetadataMutation()
    
    const { addJob, updateJob } = useJobManager();
    const { mutateAsync: recognizeTvShowByNfo } = useRecognizeTvShowByNfoMutation();
    const { mutateAsync: recognizeTvShowByTmdbIdInFolderName } =
        useRecognizeTvShowByTmdbIdInFolderNameMutation();
    const { mutateAsync: recognizeTvShowByTvdbIdInFolderName } =
        useRecognizeTvShowByTvdbIdInFolderNameMutation();
    const { mutateAsync: recognizeTvShowBySearchTvShowFolderNameInTmdb } =
        useRecognizeTvShowBySearchingFolderNameInTmdb();
    const { mutateAsync: recognizeTvShowBySearchTvShowFolderNameInTvdb } =
        useRecognizeTvShowBySearchingFolderNameInTvdb();

    const { mutateAsync: recognizeMovieByNfo } = useRecognizeMovieByNfoMutation();
    const { mutateAsync: recognizeMovieByTmdbIdInFolderName } =
        useRecognizeMovieByTmdbIdInFolderNameMutation();
    const { mutateAsync: recognizeMovieByTvdbIdInFolderName } =
        useRecognizeMovieByTvdbIdInFolderNameMutation();
    const { mutateAsync: recognizeMovieBySearchFolderNameInTmdb } =
        useRecognizeMovieBySearchingFolderNameInTmdb();
    const { mutateAsync: recognizeMovieBySearchFolderNameInTvdb } =
        useRecognizeMovieBySearchingFolderNameInTvdb();

    const jobId = useRef<string | null>(null);

    const onStart = useCallback((folder: string) => {
        const _jobId = addJob(`初始化 ${new Path(folder).name()}`);
        updateJob(_jobId, { status: "running", progress: 50 });
        jobId.current = _jobId;
        upsertFolder({
            path: folder,
            status: "initializing",
        })
        logger.info(`move status to initializing for folder: ${folder}`)

        /**
         * In Import Media Library code path, all media metadata are already put into the store by MediaLibraryImportedEventHandler
         */
        if(!latestFolders.current.find(f => f.path === folder)) {
            // if folder is not found in the store, it means it's in importing media folder code path
            // select the folder in UI
            setSelectedFolder(folder)
        } else {
            // Import Media Library
            // do nothing
        }
        
    }, [])

    const recognizeTvShow = useCallback(async (mm: MediaMetadata, traceId: string) => {
        const recognitionLanguage =
            latestUserConfig.current.preferMediaLanguage ?? "en-US";
        const tmdb = {
            upstreamBaseURL: latestUserConfig.current.tmdb?.host,
            apiKey: latestUserConfig.current.tmdb?.apiKey,
            reverseProxyUrl: appConfig.reverseProxyUrl,
        };
        const searchOrder = searchOrderForPrimaryDb(
            latestUserConfig.current.primaryDatabase
        );
        const tvSteps: RecognitionStep<Awaited<ReturnType<typeof recognizeTvShowByNfo>>>[] =
            [
                {
                    logLabel: "tvshow.nfo",
                    tryRecognize: () =>
                        recognizeTvShowByNfo({
                            mediaMetadata: mm,
                            language: recognitionLanguage,
                        }),
                },
                {
                    logLabel: "tmdbid in folder name",
                    tryRecognize: () =>
                        recognizeTvShowByTmdbIdInFolderName({
                            mediaMetadata: mm,
                            language: recognitionLanguage,
                            tmdb,
                        }),
                },
                {
                    logLabel: "tvdbid in folder name",
                    tryRecognize: () =>
                        recognizeTvShowByTvdbIdInFolderName({
                            mediaMetadata: mm,
                            language: recognitionLanguage,
                        }),
                },
                ...searchOrder.map((db) => ({
                    logLabel:
                        db === "TMDB"
                            ? "searching folder name in TMDB"
                            : "searching folder name in TVDB",
                    tryRecognize: () =>
                        db === "TMDB"
                            ? recognizeTvShowBySearchTvShowFolderNameInTmdb({
                                mediaMetadata: mm,
                                language: recognitionLanguage,
                                tmdb,
                            })
                            : recognizeTvShowBySearchTvShowFolderNameInTvdb({
                                mediaMetadata: mm,
                                language: recognitionLanguage,
                            }),
                })),
            ];
        return runRecognitionSteps(traceId, tvSteps);
    }, [])

    /** Maps async episode recognition to domain `mediaFiles` (may be empty). Caller updates UI / persistence. */
    const recognizeTvShowEpisodes = useCallback(
        async (mm: MediaMetadata, traceId: string): Promise<MediaFileMetadata[]> => {
            const recognized = await recognizeEpisodesAsync(mm);
            if (recognized.length === 0) {
                logger.warn(
                    `[${traceId}] unable to recognize episodes after recognizing media folder`
                );
            }
            return recognized.map((i) => ({
                absolutePath: i.file,
                seasonNumber: i.season,
                episodeNumber: i.episode,
            }));
        },
        []
    );

    /** First video file in `mm.files` (by `videoFileExtensions`), or empty. Movie entries only set `absolutePath`. */
    const recognizeMovieEpisode = useCallback(
        async (mm: MediaMetadata, traceId: string): Promise<MediaFileMetadata[]> => {
            const files = mm.files;
            if (!files || files.length === 0) {
                logger.warn(
                    `[${traceId}] unable to recognize movie episode after recognizing media folder`
                );
                return [];
            }
            const firstVideo = files.find((path) =>
                videoFileExtensions.includes(extname(path).toLowerCase())
            );
            if (firstVideo === undefined) {
                logger.warn(
                    `[${traceId}] unable to recognize movie episode after recognizing media folder`
                );
                return [];
            }
            return [{ absolutePath: firstVideo }];
        },
        []
    );

    const recognizeMovie = useCallback(async (mm: MediaMetadata, traceId: string) => {
        const recognitionLanguage =
            latestUserConfig.current.preferMediaLanguage ?? "en-US";
        const tmdb = {
            upstreamBaseURL: latestUserConfig.current.tmdb?.host,
            apiKey: latestUserConfig.current.tmdb?.apiKey,
            reverseProxyUrl: appConfig.reverseProxyUrl,
        };
        const searchOrder = searchOrderForPrimaryDb(
            latestUserConfig.current.primaryDatabase
        );
        const movieSteps: RecognitionStep<
            Awaited<ReturnType<typeof recognizeMovieByNfo>>
        >[] = [
                {
                    logLabel: "movie.nfo",
                    tryRecognize: () =>
                        recognizeMovieByNfo({
                            mediaMetadata: mm,
                            language: recognitionLanguage,
                        }),
                },
                {
                    logLabel: "tmdbid in folder name",
                    tryRecognize: () =>
                        recognizeMovieByTmdbIdInFolderName({
                            mediaMetadata: mm,
                            language: recognitionLanguage,
                            tmdb,
                        }),
                },
                {
                    logLabel: "tvdbid in folder name",
                    tryRecognize: () =>
                        recognizeMovieByTvdbIdInFolderName({
                            mediaMetadata: mm,
                            language: recognitionLanguage,
                        }),
                },
                ...searchOrder.map((db) => ({
                    logLabel:
                        db === "TMDB"
                            ? "searching folder name in TMDB"
                            : "searching folder name in TVDB",
                    tryRecognize: () =>
                        db === "TMDB"
                            ? recognizeMovieBySearchFolderNameInTmdb({
                                mediaMetadata: mm,
                                language: recognitionLanguage,
                                tmdb,
                            })
                            : recognizeMovieBySearchFolderNameInTvdb({
                                mediaMetadata: mm,
                                language: recognitionLanguage,
                            }),
                })),
            ];

        return runRecognitionSteps(traceId, movieSteps);
    }, [])

    const onTvShowRecognized = useCallback(async (
        folder: string,
        mm: MediaMetadata,
        tvShow: TvShowMediaMetadata,
        traceId: string
    ) => {
        await saveMediaMetadata(Path.posix(folder), {
            ...mm,
            tvShow,
        }, { traceId });
    }, [])

    const onEpisodeRecognized = useCallback(async (
        folder: string,
        mm: MediaMetadata,
        mediaFiles: MediaFileMetadata[],
        traceId: string
    ) => {
        await saveMediaMetadata(Path.posix(folder), {
            ...mm,
            mediaFiles,
        }, { traceId });
    }, [])

    const onMovieRecognized = useCallback(async (
        folder: string,
        mm: MediaMetadata,
        movie: MovieMediaMetadata,
        traceId: string
    ) => {
        await saveMediaMetadata(Path.posix(folder), {
            ...mm,
            movie,
        }, { traceId });
    }, [])

    const doInitialization = useCallback(async (
        folder: string, 
        type: FolderType,
        traceId: string) => {
        await addMediaFolderInUserConfig(traceId, folder);

        const mm: MediaMetadata = await initializeMediaMetadata({
            folderPathInPlatformFormat: Path.posix(folder),
            type: type === "tvshow" ? "tvshow-folder" : (type === "movie" ? "movie-folder" : "music-folder"),
            traceId,
        })

        await saveMediaMetadata(Path.posix(folder), mm, { traceId });

        if (type === "tvshow") {

            // stage 1: recognize folder, to know which TV Show it is
            const tvShow: TvShowMediaMetadata | undefined = await recognizeTvShow(mm, traceId);
            console.log(`[${traceId}] finish tvshow recognition for folder: ${folder}`);
            if (tvShow !== undefined) {
                logger.info({
                    traceId,
                    folder,
                    tvShow,
                }, `successfully recognized tvshow for folder: ${folder}`);
                await onTvShowRecognized(folder, mm, tvShow, traceId);

                // stage 2: recognize episodes, to link local video files for each episode
                const mediaFiles = await recognizeTvShowEpisodes({ ...mm, tvShow }, traceId);
                logger.info({
                    traceId,
                    folder,
                }, `successfully recognized episodes for folder: ${folder}`);
                await onEpisodeRecognized(folder, { ...mm, tvShow }, mediaFiles, traceId);
            } else {
                logger.info({
                    traceId,
                    folder,
                }, `unable to recognize tvshow for folder: ${folder}`);
            }

        } else if (type === "movie") {
            const movie: MovieMediaMetadata | undefined = await recognizeMovie(mm, traceId);
            if (movie !== undefined) {
                logger.info({
                    traceId,
                    folder,
                    movie,
                }, `successfully recognized movie for folder: ${folder}`);
                await onMovieRecognized(folder, mm, movie, traceId);

                const mediaFiles = await recognizeMovieEpisode({ ...mm, movie }, traceId);
                logger.info({
                    traceId,
                    folder,
                }, `successfully recognized movie episode file for folder: ${folder}`);
                await onEpisodeRecognized(folder, { ...mm, movie }, mediaFiles, traceId);
            } else {
                logger.info({
                    traceId,
                    folder,
                }, `unable to recognize movie for folder: ${folder}`);
            }
        } else {
            logger.info({
                traceId,
                folder,
            }, `skip initialization for folder: ${folder} of type: ${type}`);
        }

    }, [])

    /**
     * Should be called no matter succeeded or failed
     */
    const onFinish = useCallback(async (folder: string) => {

        if (!jobId.current) {
            return;
        }

        upsertFolder({
            path: folder,
            status: "ok",
        })

    }, [])

    const onSucceeded = useCallback((_folder: string) => {
        if (!jobId.current) {
            return;
        }
        updateJob(jobId.current, { status: "succeeded" });
    }, [])

    const onError = useCallback((_folder: string, error: Error) => {

        if (!jobId.current) {
            return;
        }

        if (error instanceof Error && error.name === 'TimeoutError') {
            toast.error('初始化目录超时');
            updateJob(jobId.current, { status: "aborted" });
        } else {
            const unknownErrorStack = error instanceof Error
                ? (error.stack || error.message)
                : String(error);
            console.error(`Unknown error during media folder initialization:\n${unknownErrorStack}`);
            toast.error(`因未知原因, 目录初始化失败:\n${error instanceof Error ? error.message : String(error)}`);
            updateJob(jobId.current, { status: "failed" });
        }

    }, [])

    const initializeImportedMediaFolder = async (event: Event) => {
        const data = (event as CustomEvent<OnMediaFolderImportedEventData>).detail;

        const { type, folderPathInPlatformFormat } = data;
        const traceId = data.traceId || `${nextTraceId()}`;


        try {

            logger.info({
                traceId,
                path: folderPathInPlatformFormat,
            }, 'started initialization')

            onStart(folderPathInPlatformFormat);

            await withTimeout(async () => {
                await doInitialization(folderPathInPlatformFormat, type, traceId);
                onSucceeded(folderPathInPlatformFormat);
            }, 60 * 1000)

        } catch (error) {
            logger.error(error, 'failed to initialize media folder');
            onError(folderPathInPlatformFormat, error as Error);
        } finally {

            logger.info({
                traceId,
                path: folderPathInPlatformFormat,
            }, 'ended initialization')

            onFinish(folderPathInPlatformFormat);

        }
    };

    return { initializeImportedMediaFolder };
}
