import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { Path } from "@core/path";
import { createMediaMetadata } from "@core/mediaMetadata";
import type { UIMediaMetadata } from "@/types/UIMediaMetadata";
import type { OnMediaFolderImportedEventData } from "@/types/eventTypes";
import type { MovieMediaMetadata, TvShowMediaMetadata } from "@core/types";

const h = vi.hoisted(() => {
    const getMediaMetadata = vi.fn();
    const updateMediaMetadata = vi.fn().mockResolvedValue(undefined);
    const saveMediaMetadata = vi.fn().mockResolvedValue(undefined);
    const initializeMediaMetadata = vi.fn();
    const addMediaFolderInUserConfig = vi.fn().mockResolvedValue(undefined);
    const setSelectedByMediaFolderPath = vi.fn();
    const upsertFolder = vi.fn();
    const setSelectedFolder = vi.fn();
    const folders: Array<{ path: string }> = [];
    const addJob = vi.fn(() => "job-1");
    const updateJob = vi.fn();
    const runRecognitionSteps = vi.fn();
    const recognizeEpisodesWorker = vi.fn();
    const mutationHook = () => ({
        mutateAsync: vi.fn().mockResolvedValue(undefined),
    });
    const toast = { error: vi.fn() };
    const withTimeout = vi.fn((fn: () => Promise<unknown>) => fn());
    return {
        getMediaMetadata,
        updateMediaMetadata,
        saveMediaMetadata,
        initializeMediaMetadata,
        addMediaFolderInUserConfig,
        setSelectedByMediaFolderPath,
        upsertFolder,
        setSelectedFolder,
        folders,
        addJob,
        updateJob,
        runRecognitionSteps,
        recognizeEpisodesWorker,
        mutationHook,
        toast,
        withTimeout,
    };
});

vi.mock("@/lib/utils", () => ({
    nextTraceId: vi.fn(() => "hook-trace-ref"),
}));

vi.mock("@/lib/log", () => ({
    logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
    },
}));

vi.mock("es-toolkit", async (importOriginal) => {
    const actual = await importOriginal<typeof import("es-toolkit")>();
    return {
        ...actual,
        withTimeout: h.withTimeout,
    };
});

vi.mock("sonner", () => ({
    toast: h.toast,
}));

vi.mock("@/stores/mediaMetadataStore", () => ({
    useMediaMetadataStore: vi.fn(),
    useMediaMetadataStoreActions: () => ({
        getMediaMetadata: h.getMediaMetadata,
        setSelectedByMediaFolderPath: h.setSelectedByMediaFolderPath,
    }),
}));

vi.mock("@/actions/mediaMetadataActions", () => ({
    useMediaMetadataActions: () => ({
        updateMediaMetadata: h.updateMediaMetadata,
        saveMediaMetadata: h.saveMediaMetadata,
        initializeMediaMetadata: h.initializeMediaMetadata,
    }),
}));

vi.mock("../mediaMetadata", () => ({
    useInitializeMediaMetadataMutation: () => ({
        mutateAsync: h.initializeMediaMetadata,
    }),
    useUpdateMediaMetadataMutation: () => ({
        saveMediaMetadata: h.saveMediaMetadata,
    }),
}));

vi.mock("@/hooks/useJobManager", () => ({
    useJobManager: () => ({
        addJob: h.addJob,
        updateJob: h.updateJob,
    }),
}));

vi.mock("@/stores/uiMediaFolderStore", () => ({
    useUIMediaFolderStore: (selector: (state: {
        upsertFolder: typeof h.upsertFolder
        setSelectedFolder: typeof h.setSelectedFolder
        folders: typeof h.folders
    }) => unknown) =>
        selector({
            upsertFolder: h.upsertFolder,
            setSelectedFolder: h.setSelectedFolder,
            folders: h.folders,
        }),
}));

vi.mock("@/hooks/userConfig", () => ({
    useConfig: () => ({
        appConfig: {
            reverseProxyUrl: "http://127.0.0.1:30005",
        },
        userConfig: {
            preferMediaLanguage: "en-US",
            primaryDatabase: "TMDB" as const,
        },
        addMediaFolderInUserConfig: h.addMediaFolderInUserConfig,
    }),
}));

vi.mock("@/hooks/userConfig/useHelloQuery", () => ({
    useHelloQuery: () => ({
        data: { osLocale: "en-US" },
    }),
}));

vi.mock("@/lib/mediaFolderRecognitionPipeline", async (importOriginal) => {
    const actual = await importOriginal<typeof import("@/lib/mediaFolderRecognitionPipeline")>();
    return {
        ...actual,
        runRecognitionSteps: h.runRecognitionSteps,
    };
});

vi.mock("@/lib/recognizeEpisodes", () => ({
    recognizeEpisodes: h.recognizeEpisodesWorker,
}));

vi.mock("@/hooks/initialization/useRecognizeTvShowByNfoMutation", () => ({
    useRecognizeTvShowByNfoMutation: h.mutationHook,
}));
vi.mock("@/hooks/initialization/useRecognizeTvShowBySearchingFolderNameInTvdb", () => ({
    useRecognizeTvShowBySearchingFolderNameInTvdb: h.mutationHook,
}));
vi.mock("@/hooks/initialization/useRecognizeTvShowBySearchingFolderNameInTmdb", () => ({
    useRecognizeTvShowBySearchingFolderNameInTmdb: h.mutationHook,
}));
vi.mock("@/hooks/initialization/useRecognizeTvShowByTmdbIdInFolderNameMutation", () => ({
    useRecognizeTvShowByTmdbIdInFolderNameMutation: h.mutationHook,
}));
vi.mock("@/hooks/initialization/useRecognizeTvShowByTvdbIdInFolderNameMutation", () => ({
    useRecognizeTvShowByTvdbIdInFolderNameMutation: h.mutationHook,
}));
vi.mock("@/hooks/initialization/useRecognizeMovieByNfoMutation", () => ({
    useRecognizeMovieByNfoMutation: h.mutationHook,
}));
vi.mock("@/hooks/initialization/useRecognizeMovieBySearchingFolderNameInTvdb", () => ({
    useRecognizeMovieBySearchingFolderNameInTvdb: h.mutationHook,
}));
vi.mock("@/hooks/initialization/useRecognizeMovieBySearchingFolderNameInTmdb", () => ({
    useRecognizeMovieBySearchingFolderNameInTmdb: h.mutationHook,
}));
vi.mock("@/hooks/initialization/useRecognizeMovieByTmdbIdInFolderNameMutation", () => ({
    useRecognizeMovieByTmdbIdInFolderNameMutation: h.mutationHook,
}));
vi.mock("@/hooks/initialization/useRecognizeMovieByTvdbIdInFolderNameMutation", () => ({
    useRecognizeMovieByTvdbIdInFolderNameMutation: h.mutationHook,
}));

import { useInitializeImportedMediaFolder } from "./useInitializeImportedMediaFolder";

describe("useInitializeImportedMediaFolder", () => {
    const folderPath = "/test/MyShow";
    const posixPath = Path.posix(folderPath);

    const mockTvShow: TvShowMediaMetadata = {
        id: "999",
        database: "TMDB",
        name: "Mock Show",
        seasons: [],
    };

    const mockMovie: MovieMediaMetadata = {
        id: "888",
        database: "TMDB",
        name: "Mock Movie",
        airDate: "2025-01-01",
    };

    let baseMm: UIMediaMetadata;

    beforeEach(() => {
        vi.clearAllMocks();
        h.addJob.mockReturnValue("job-1");
        h.withTimeout.mockImplementation((fn: () => Promise<unknown>) => fn());
        baseMm = {
            ...createMediaMetadata(folderPath, "tvshow-folder"),
            status: "idle",
        };
        /** Import single media folder path: metadata not in store yet (see hook comment on getMediaMetadata). */
        h.getMediaMetadata.mockReturnValue(undefined);
        h.initializeMediaMetadata.mockResolvedValue(baseMm);
        h.runRecognitionSteps.mockResolvedValue(mockTvShow);
        h.recognizeEpisodesWorker.mockResolvedValue([
            { file: `${posixPath}/S01E01.mkv`, season: 1, episode: 1 },
        ]);
    });

    function assertSuccessfulTvShowInitializationPipeline() {
        expect(h.addMediaFolderInUserConfig).toHaveBeenCalledWith("evt-trace", folderPath);

        expect(h.runRecognitionSteps).toHaveBeenCalledWith(
            "evt-trace",
            expect.any(Array)
        );

        expect(h.recognizeEpisodesWorker).toHaveBeenCalledTimes(1);
        expect(h.recognizeEpisodesWorker).toHaveBeenCalledWith(
            expect.objectContaining({
                mediaFolderPath: posixPath,
                tvShow: mockTvShow,
            })
        );

        const tvShowCall = h.saveMediaMetadata.mock.calls.find((call) => {
            if (call[0] !== posixPath) return false;
            const payload = call[1] as Partial<UIMediaMetadata> | undefined;
            return payload?.tvShow?.id === mockTvShow.id;
        });
        expect(tvShowCall).toBeDefined();
        expect((tvShowCall![1] as Partial<UIMediaMetadata>).tvShow).toEqual(mockTvShow);

        const episodeCall = h.saveMediaMetadata.mock.calls.find((call) => {
            if (call[0] !== posixPath) return false;
            const payload = call[1] as Partial<UIMediaMetadata> | undefined;
            return Array.isArray(payload?.mediaFiles) && payload.mediaFiles.length === 1;
        });
        expect(episodeCall).toBeDefined();
        expect((episodeCall![1] as Partial<UIMediaMetadata>).mediaFiles).toEqual([
            {
                absolutePath: `${posixPath}/S01E01.mkv`,
                seasonNumber: 1,
                episodeNumber: 1,
            },
        ]);

        expect(h.updateJob).toHaveBeenCalledWith("job-1", { status: "succeeded" });
    }

    it("initialize TV show folder", async () => {
        const { result } = renderHook(() => useInitializeImportedMediaFolder());

        const detail: OnMediaFolderImportedEventData = {
            type: "tvshow",
            folderPathInPlatformFormat: folderPath,
            traceId: "evt-trace",
        };
        const event = new CustomEvent("ui.mediaFolderImported", { detail }) as Event;

        await act(async () => {
            await result.current.initializeImportedMediaFolder(event);
        });

        expect(h.initializeMediaMetadata).toHaveBeenCalledWith({
            folderPathInPlatformFormat: folderPath,
            type: "tvshow-folder",
            traceId: "evt-trace",
        });

        assertSuccessfulTvShowInitializationPipeline();
    });

    it("initialize TV show library", async () => {
        /** Media library import: MediaLibraryImportedEventHandler already placed metadata in the store. */
        h.getMediaMetadata.mockImplementation((path: string) =>
            path === posixPath ? baseMm : undefined
        );

        const { result } = renderHook(() => useInitializeImportedMediaFolder());

        const detail: OnMediaFolderImportedEventData = {
            type: "tvshow",
            folderPathInPlatformFormat: folderPath,
            traceId: "evt-trace",
        };
        const event = new CustomEvent("ui.mediaFolderImported", { detail }) as Event;

        await act(async () => {
            await result.current.initializeImportedMediaFolder(event);
        });

        expect(h.initializeMediaMetadata).toHaveBeenCalledWith({
            folderPathInPlatformFormat: folderPath,
            type: "tvshow-folder",
            traceId: "evt-trace",
        });

        assertSuccessfulTvShowInitializationPipeline();
    });

    function assertSuccessfulMovieInitializationPipeline() {
        expect(h.addMediaFolderInUserConfig).toHaveBeenCalledWith("evt-trace", folderPath);

        expect(h.runRecognitionSteps).toHaveBeenCalledWith(
            "evt-trace",
            expect.any(Array)
        );

        const movieCall = h.saveMediaMetadata.mock.calls.find((call) => {
            if (call[0] !== posixPath) return false;
            const payload = call[1] as Partial<UIMediaMetadata> | undefined;
            return payload?.movie?.id === mockMovie.id;
        });
        expect(movieCall).toBeDefined();
        expect((movieCall![1] as Partial<UIMediaMetadata>).movie).toEqual(mockMovie);

        expect(h.updateJob).toHaveBeenCalledWith("job-1", { status: "succeeded" });
    }

    it("initialize movie folder", async () => {
        h.getMediaMetadata.mockReturnValue(undefined);
        h.runRecognitionSteps.mockResolvedValue(mockMovie);
        baseMm = {
            ...createMediaMetadata(folderPath, "movie-folder"),
            status: "idle",
        };
        h.initializeMediaMetadata.mockResolvedValue(baseMm);

        const { result } = renderHook(() => useInitializeImportedMediaFolder());

        const detail: OnMediaFolderImportedEventData = {
            type: "movie",
            folderPathInPlatformFormat: folderPath,
            traceId: "evt-trace",
        };
        const event = new CustomEvent("ui.mediaFolderImported", { detail }) as Event;

        await act(async () => {
            await result.current.initializeImportedMediaFolder(event);
        });

        expect(h.initializeMediaMetadata).toHaveBeenCalledWith({
            folderPathInPlatformFormat: folderPath,
            type: "movie-folder",
            traceId: "evt-trace",
        });

        assertSuccessfulMovieInitializationPipeline();
    });

    it("initialize movie library", async () => {
        h.getMediaMetadata.mockImplementation((path: string) =>
            path === posixPath ? baseMm : undefined
        );
        h.runRecognitionSteps.mockResolvedValue(mockMovie);
        baseMm = {
            ...createMediaMetadata(folderPath, "movie-folder"),
            status: "idle",
        };

        const { result } = renderHook(() => useInitializeImportedMediaFolder());

        const detail: OnMediaFolderImportedEventData = {
            type: "movie",
            folderPathInPlatformFormat: folderPath,
            traceId: "evt-trace",
        };
        const event = new CustomEvent("ui.mediaFolderImported", { detail }) as Event;

        await act(async () => {
            await result.current.initializeImportedMediaFolder(event);
        });

        expect(h.initializeMediaMetadata).toHaveBeenCalledWith({
            folderPathInPlatformFormat: folderPath,
            type: "movie-folder",
            traceId: "evt-trace",
        });

        assertSuccessfulMovieInitializationPipeline();
    });

    it("initialize movie folder with movie episode file", async () => {
        h.getMediaMetadata.mockReturnValue(undefined);
        h.runRecognitionSteps.mockResolvedValue(mockMovie);
        const videoPath = `${posixPath}/Film.mkv`;
        baseMm = {
            ...createMediaMetadata(folderPath, "movie-folder"),
            status: "idle",
            files: [`${posixPath}/poster.jpg`, videoPath],
        };
        h.initializeMediaMetadata.mockResolvedValue(baseMm);

        const { result } = renderHook(() => useInitializeImportedMediaFolder());

        const detail: OnMediaFolderImportedEventData = {
            type: "movie",
            folderPathInPlatformFormat: folderPath,
            traceId: "evt-trace",
        };
        const event = new CustomEvent("ui.mediaFolderImported", { detail }) as Event;

        await act(async () => {
            await result.current.initializeImportedMediaFolder(event);
        });

        assertSuccessfulMovieInitializationPipeline();

        const episodeCall = h.saveMediaMetadata.mock.calls.find((call) => {
            if (call[0] !== posixPath) return false;
            const payload = call[1] as Partial<UIMediaMetadata> | undefined;
            return (
                payload?.movie?.id === mockMovie.id &&
                Array.isArray(payload.mediaFiles) &&
                payload.mediaFiles.length === 1
            );
        });
        expect(episodeCall).toBeDefined();
        expect((episodeCall![1] as Partial<UIMediaMetadata>).mediaFiles).toEqual([{ absolutePath: videoPath }]);
    });

    function assertSuccessfulMusicInitializationPipeline() {
        expect(h.addMediaFolderInUserConfig).toHaveBeenCalledWith("evt-trace", folderPath);

        expect(h.runRecognitionSteps).not.toHaveBeenCalled();
        expect(h.recognizeEpisodesWorker).not.toHaveBeenCalled();

        const hasSavedMetadata = h.saveMediaMetadata.mock.calls.some((call) => {
            if (call[0] !== posixPath) return false;
            const payload = call[1];
            return typeof payload === "object" && payload !== null;
        });
        expect(hasSavedMetadata).toBe(true);

        expect(h.updateJob).toHaveBeenCalledWith("job-1", { status: "succeeded" });
    }

    it("initialize music folder", async () => {
        h.getMediaMetadata.mockReturnValue(undefined);
        baseMm = {
            ...createMediaMetadata(folderPath, "music-folder"),
            status: "idle",
        };
        h.initializeMediaMetadata.mockResolvedValue(baseMm);

        const { result } = renderHook(() => useInitializeImportedMediaFolder());

        const detail: OnMediaFolderImportedEventData = {
            type: "music",
            folderPathInPlatformFormat: folderPath,
            traceId: "evt-trace",
        };
        const event = new CustomEvent("ui.mediaFolderImported", { detail }) as Event;

        await act(async () => {
            await result.current.initializeImportedMediaFolder(event);
        });

        expect(h.initializeMediaMetadata).toHaveBeenCalledWith({
            folderPathInPlatformFormat: folderPath,
            type: "music-folder",
            traceId: "evt-trace",
        });

        assertSuccessfulMusicInitializationPipeline();
    });

    it("initialize music library", async () => {
        h.getMediaMetadata.mockImplementation((path: string) =>
            path === posixPath ? baseMm : undefined
        );
        baseMm = {
            ...createMediaMetadata(folderPath, "music-folder"),
            status: "idle",
        };

        const { result } = renderHook(() => useInitializeImportedMediaFolder());

        const detail: OnMediaFolderImportedEventData = {
            type: "music",
            folderPathInPlatformFormat: folderPath,
            traceId: "evt-trace",
        };
        const event = new CustomEvent("ui.mediaFolderImported", { detail }) as Event;

        await act(async () => {
            await result.current.initializeImportedMediaFolder(event);
        });

        expect(h.initializeMediaMetadata).toHaveBeenCalledWith({
            folderPathInPlatformFormat: folderPath,
            type: "music-folder",
            traceId: "evt-trace",
        });

        assertSuccessfulMusicInitializationPipeline();
    });

    function assertFailedRecognitionPipeline() {
        expect(h.toast.error).toHaveBeenCalledWith(
            expect.stringContaining("目录初始化失败")
        );
        expect(h.updateJob).toHaveBeenCalledWith("job-1", { status: "failed" });

        const hasSavedMetadata = h.saveMediaMetadata.mock.calls.some((call) => {
            if (call[0] !== posixPath) return false;
            const payload = call[1];
            return typeof payload === "object" && payload !== null;
        });
        expect(hasSavedMetadata).toBe(true);
    }

    it("handles error when TV show recognition fails", async () => {
        h.getMediaMetadata.mockReturnValue(undefined);
        h.runRecognitionSteps.mockRejectedValue(new Error("recognition failed"));
        baseMm = {
            ...createMediaMetadata(folderPath, "tvshow-folder"),
            status: "idle",
        };
        h.initializeMediaMetadata.mockResolvedValue(baseMm);

        const { result } = renderHook(() => useInitializeImportedMediaFolder());

        const detail: OnMediaFolderImportedEventData = {
            type: "tvshow",
            folderPathInPlatformFormat: folderPath,
            traceId: "evt-trace",
        };
        const event = new CustomEvent("ui.mediaFolderImported", { detail }) as Event;

        await act(async () => {
            await result.current.initializeImportedMediaFolder(event);
        });

        assertFailedRecognitionPipeline();
    });

    it("handles error when episode recognition fails", async () => {
        h.getMediaMetadata.mockReturnValue(undefined);
        h.runRecognitionSteps.mockResolvedValue(mockTvShow);
        h.recognizeEpisodesWorker.mockRejectedValue(new Error("episode recognition failed"));
        baseMm = {
            ...createMediaMetadata(folderPath, "tvshow-folder"),
            status: "idle",
        };
        h.initializeMediaMetadata.mockResolvedValue(baseMm);

        const { result } = renderHook(() => useInitializeImportedMediaFolder());

        const detail: OnMediaFolderImportedEventData = {
            type: "tvshow",
            folderPathInPlatformFormat: folderPath,
            traceId: "evt-trace",
        };
        const event = new CustomEvent("ui.mediaFolderImported", { detail }) as Event;

        await act(async () => {
            await result.current.initializeImportedMediaFolder(event);
        });

        assertFailedRecognitionPipeline();
    });

    it("handles error when movie recognition fails", async () => {
        h.getMediaMetadata.mockReturnValue(undefined);
        h.runRecognitionSteps.mockRejectedValue(new Error("movie recognition failed"));
        baseMm = {
            ...createMediaMetadata(folderPath, "movie-folder"),
            status: "idle",
        };
        h.initializeMediaMetadata.mockResolvedValue(baseMm);

        const { result } = renderHook(() => useInitializeImportedMediaFolder());

        const detail: OnMediaFolderImportedEventData = {
            type: "movie",
            folderPathInPlatformFormat: folderPath,
            traceId: "evt-trace",
        };
        const event = new CustomEvent("ui.mediaFolderImported", { detail }) as Event;

        await act(async () => {
            await result.current.initializeImportedMediaFolder(event);
        });

        assertFailedRecognitionPipeline();
    });

    it("handles timeout when initializing TV show folder", async () => {
        const timeoutError = new Error("Timeout");
        timeoutError.name = "TimeoutError";
        h.withTimeout.mockRejectedValue(timeoutError);

        h.getMediaMetadata.mockReturnValue(undefined);
        baseMm = {
            ...createMediaMetadata(folderPath, "tvshow-folder"),
            status: "idle",
        };
        h.initializeMediaMetadata.mockResolvedValue(baseMm);

        const { result } = renderHook(() => useInitializeImportedMediaFolder());

        const detail: OnMediaFolderImportedEventData = {
            type: "tvshow",
            folderPathInPlatformFormat: folderPath,
            traceId: "evt-trace",
        };
        const event = new CustomEvent("ui.mediaFolderImported", { detail }) as Event;

        await act(async () => {
            await result.current.initializeImportedMediaFolder(event);
        });

        expect(h.toast.error).toHaveBeenCalledWith("初始化目录超时");
        expect(h.updateJob).toHaveBeenCalledWith("job-1", { status: "aborted" });

        expect(h.upsertFolder).toHaveBeenCalledWith({
            path: folderPath,
            status: "ok",
        });
    });

    function assertUnrecognizedButSuccessfulPipeline() {
        expect(h.updateJob).toHaveBeenCalledWith("job-1", { status: "succeeded" });

        const hasSavedMetadata = h.saveMediaMetadata.mock.calls.some((call) => {
            if (call[0] !== posixPath) return false;
            const payload = call[1];
            return typeof payload === "object" && payload !== null;
        });
        expect(hasSavedMetadata).toBe(true);

        expect(h.toast.error).not.toHaveBeenCalled();
    }

    it("completes successfully when no TV show was recognized", async () => {
        h.getMediaMetadata.mockReturnValue(undefined);
        h.runRecognitionSteps.mockResolvedValue(undefined);
        baseMm = {
            ...createMediaMetadata(folderPath, "tvshow-folder"),
            status: "idle",
        };
        h.initializeMediaMetadata.mockResolvedValue(baseMm);

        const { result } = renderHook(() => useInitializeImportedMediaFolder());

        const detail: OnMediaFolderImportedEventData = {
            type: "tvshow",
            folderPathInPlatformFormat: folderPath,
            traceId: "evt-trace",
        };
        const event = new CustomEvent("ui.mediaFolderImported", { detail }) as Event;

        await act(async () => {
            await result.current.initializeImportedMediaFolder(event);
        });

        expect(h.runRecognitionSteps).toHaveBeenCalledWith(
            "evt-trace",
            expect.any(Array)
        );
        expect(h.recognizeEpisodesWorker).not.toHaveBeenCalled();

        assertUnrecognizedButSuccessfulPipeline();
    });

    it("completes successfully when no episodes were recognized", async () => {
        h.getMediaMetadata.mockReturnValue(undefined);
        h.runRecognitionSteps.mockResolvedValue(mockTvShow);
        h.recognizeEpisodesWorker.mockResolvedValue([]);
        baseMm = {
            ...createMediaMetadata(folderPath, "tvshow-folder"),
            status: "idle",
        };
        h.initializeMediaMetadata.mockResolvedValue(baseMm);

        const { result } = renderHook(() => useInitializeImportedMediaFolder());

        const detail: OnMediaFolderImportedEventData = {
            type: "tvshow",
            folderPathInPlatformFormat: folderPath,
            traceId: "evt-trace",
        };
        const event = new CustomEvent("ui.mediaFolderImported", { detail }) as Event;

        await act(async () => {
            await result.current.initializeImportedMediaFolder(event);
        });

        expect(h.recognizeEpisodesWorker).toHaveBeenCalledWith(
            expect.objectContaining({
                mediaFolderPath: posixPath,
                tvShow: mockTvShow,
            })
        );

        const episodeCall = h.saveMediaMetadata.mock.calls.find((call) => {
            if (call[0] !== posixPath) return false;
            const payload = call[1] as Partial<UIMediaMetadata> | undefined;
            return Array.isArray(payload?.mediaFiles) && payload.mediaFiles.length === 0;
        });
        expect(episodeCall).toBeDefined();

        assertUnrecognizedButSuccessfulPipeline();
    });

    it("completes successfully when no movie was recognized", async () => {
        h.getMediaMetadata.mockReturnValue(undefined);
        h.runRecognitionSteps.mockResolvedValue(undefined);
        baseMm = {
            ...createMediaMetadata(folderPath, "movie-folder"),
            status: "idle",
        };
        h.initializeMediaMetadata.mockResolvedValue(baseMm);

        const { result } = renderHook(() => useInitializeImportedMediaFolder());

        const detail: OnMediaFolderImportedEventData = {
            type: "movie",
            folderPathInPlatformFormat: folderPath,
            traceId: "evt-trace",
        };
        const event = new CustomEvent("ui.mediaFolderImported", { detail }) as Event;

        await act(async () => {
            await result.current.initializeImportedMediaFolder(event);
        });

        expect(h.runRecognitionSteps).toHaveBeenCalledWith(
            "evt-trace",
            expect.any(Array)
        );

        assertUnrecognizedButSuccessfulPipeline();
    });
});
