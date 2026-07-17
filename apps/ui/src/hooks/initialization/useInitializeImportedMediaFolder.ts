import { useTranslation } from "@/lib/i18n"
import { TmdbFetchError, classifyTmdbError, formatTmdbErrorForDisplay, SMM_TMDB_DEFAULT_UPSTREAM } from "@/api/tmdb"
import { useLatest } from "react-use";
import { useJobManager } from "@/hooks/useJobManager";
import { useConfig } from "@/hooks/userConfig";
import { useHelloQuery } from "@/hooks/userConfig/useHelloQuery";
import { getBrowserLocale, getResolvedLanguages } from "@/hooks/useResolvedLanguages";
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
import { persistHarmonyOSFileAccess } from "@/lib/persistHarmonyOSFileAccess";
import { redactUserConfig } from "@/lib/redactUserConfig";

export function useInitializeImportedMediaFolder() {

    const upsertFolder = useUIMediaFolderStore(state => state.upsertFolder)
    const setSelectedFolder = useUIMediaFolderStore(state => state.setSelectedFolder)
    const folders = useUIMediaFolderStore(state => state.folders)
    const latestFolders = useLatest(folders);
    const { addMediaFolderInUserConfig, userConfig } = useConfig();
    const latestUserConfig = useLatest(userConfig);
    const helloQuery = useHelloQuery();
    const latestOsLocale = useLatest(helloQuery.data?.osLocale);
    const { t } = useTranslation(["errors"])

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

    const onStart = useCallback((folder: string, folderType: FolderType) => {
        console.log(`[DIAG] useInitializeImportedMediaFolder.onStart: folder=${folder} type=${folderType}`)
        const _jobId = addJob(`初始化 ${new Path(folder).name()}`);
        updateJob(_jobId, { status: "running", progress: 50 });
        jobId.current = _jobId;
        const mediaType: MediaMetadata["type"] =
            folderType === "tvshow" ? "tvshow-folder"
            : folderType === "movie" ? "movie-folder"
            : "music-folder"
        console.log(`[DIAG] useInitializeImportedMediaFolder.onStart: calling upsertFolder status=initializing`)
        upsertFolder({
            path: folder,
            status: "initializing",
            type: mediaType,
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

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    const recognizeTvShow = useCallback(async (mm: MediaMetadata, traceId: string) => {
        const recognitionLanguage = getResolvedLanguages(latestUserConfig.current, {
            browserLocale: getBrowserLocale(),
            osLocale: latestOsLocale.current,
        }).mediaLanguage;
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
                            })
                            : recognizeTvShowBySearchTvShowFolderNameInTvdb({
                                mediaMetadata: mm,
                                language: recognitionLanguage,
                            }),
                })),
            ];
        return runRecognitionSteps(traceId, tvSteps);
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
        const recognitionLanguage = getResolvedLanguages(latestUserConfig.current, {
            browserLocale: getBrowserLocale(),
            osLocale: latestOsLocale.current,
        }).mediaLanguage;
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
                            })
                            : recognizeMovieBySearchFolderNameInTvdb({
                                mediaMetadata: mm,
                                language: recognitionLanguage,
                            }),
                })),
            ];

        return runRecognitionSteps(traceId, movieSteps);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    const onTvShowRecognized = useCallback(async (
        folder: string,
        mm: MediaMetadata,
        tvShow: TvShowMediaMetadata,
        traceId: string
    ) => {
        logger.info({
            traceId,
            stage: 'save.tvshow',
            folder,
            tvShowId: tvShow?.id,
            tvShowName: tvShow?.name,
        }, 'persisting recognized tvshow')
        await saveMediaMetadata(Path.posix(folder), {
            ...mm,
            tvShow,
        }, { traceId });
        logger.info({
            traceId,
            stage: 'save.tvshow',
            folder,
            tvShowId: tvShow?.id,
        }, 'persisted recognized tvshow')
    }, [saveMediaMetadata])

    const onEpisodeRecognized = useCallback(async (
        folder: string,
        mm: MediaMetadata,
        mediaFiles: MediaFileMetadata[],
        traceId: string
    ) => {
        logger.info({
            traceId,
            stage: 'save.episodes',
            folder,
            mediaFileCount: mediaFiles.length,
        }, 'persisting recognized episodes')
        await saveMediaMetadata(Path.posix(folder), {
            ...mm,
            mediaFiles,
        }, { traceId });
        logger.info({
            traceId,
            stage: 'save.episodes',
            folder,
            mediaFileCount: mediaFiles.length,
        }, 'persisted recognized episodes')
    }, [saveMediaMetadata])

    const onMovieRecognized = useCallback(async (
        folder: string,
        mm: MediaMetadata,
        movie: MovieMediaMetadata,
        traceId: string
    ) => {
        logger.info({
            traceId,
            stage: 'save.movie',
            folder,
            movieId: movie?.id,
            movieName: movie?.name,
        }, 'persisting recognized movie')
        await saveMediaMetadata(Path.posix(folder), {
            ...mm,
            movie,
        }, { traceId });
        logger.info({
            traceId,
            stage: 'save.movie',
            folder,
            movieId: movie?.id,
        }, 'persisted recognized movie')
    }, [saveMediaMetadata])

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
                    tvShow: redactUserConfig(tvShow),
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
                    movie: redactUserConfig(movie),
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

    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    /**
     * Should be called no matter succeeded or failed
     */
    const onFinish = useCallback(async (folder: string) => {

        if (!jobId.current) {
            return;
        }

        console.log(`[DIAG] useInitializeImportedMediaFolder.onFinish: calling upsertFolder status=ok folder=${folder}`)
        logger.info({
            jobId: jobId.current,
            stage: 'initialization',
            folder,
        }, 'initialization: finished')

        upsertFolder({
            path: folder,
            status: "ok",
        })

    }, [upsertFolder])

    const onSucceeded = useCallback((_folder: string) => {
        if (!jobId.current) {
            return;
        }
        updateJob(jobId.current, { status: "succeeded" });
        logger.info({
            jobId: jobId.current,
            stage: 'initialization',
            folder: _folder,
        }, 'initialization: succeeded')
    }, [updateJob])

    const onError = useCallback((_folder: string, error: Error) => {
        const errorName = error instanceof Error ? error.name : 'UnknownError'
        const errorMessage = error instanceof Error ? error.message : String(error)
        const isTimeout = errorName === 'TimeoutError'

        if (isTimeout) {
            logger.warn({
                stage: 'initialization',
                folder: _folder,
                errorName,
                errorMessage,
            }, 'initialization: timeout')
            toast.error('初始化目录超时');
        } else if (error instanceof TmdbFetchError) {
            const tmdbUrl = latestUserConfig.current?.tmdb?.host?.trim() || SMM_TMDB_DEFAULT_UPSTREAM
            const display = classifyTmdbError(error, tmdbUrl)
            const message = formatTmdbErrorForDisplay(display, t)
            logger.error({
                stage: 'initialization',
                folder: _folder,
                errorName,
                errorMessage,
                tmdbError: {
                    kind: error.info.kind,
                    statusCode: error.info.statusCode,
                    problemDetail: error.info.problemDetail,
                    responseBodyText: error.info.responseBodyText,
                },
            }, 'initialization: tmdb failed')
            toast.error(`目录初始化失败:\n${message}`);
        } else {
            const unknownErrorStack = error instanceof Error
                ? (error.stack || error.message)
                : String(error);
            console.error(`Unknown error during media folder initialization:\n${unknownErrorStack}`);
            logger.error({
                stage: 'initialization',
                folder: _folder,
                errorName,
                errorMessage,
                stack: unknownErrorStack,
            }, 'initialization: failed')
            toast.error(`因未知原因, 目录初始化失败:\n${errorMessage}`);
        }

        if (!jobId.current) {
            return;
        }

        if (isTimeout) {
            updateJob(jobId.current, { status: "aborted" });
        } else {
            updateJob(jobId.current, { status: "failed" });
        }

    }, [updateJob, t, latestUserConfig])

    const initializeImportedMediaFolder = async (event: Event) => {
        const data = (event as CustomEvent<OnMediaFolderImportedEventData>).detail;

        const { type, folderPathInPlatformFormat } = data;
        const traceId = data.traceId || `${nextTraceId()}`;

        console.log(`[DIAG] initializeImportedMediaFolder: invoked folder=${folderPathInPlatformFormat} type=${type} traceId=${traceId}`)


        try {

            logger.info({
                traceId,
                path: folderPathInPlatformFormat,
            }, 'started initialization')

            await persistHarmonyOSFileAccess([folderPathInPlatformFormat]);

            onStart(folderPathInPlatformFormat, type);

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
