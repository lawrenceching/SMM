import type { MetadataFiles } from "@smm/types/MetadataFiles";
import { useMemo } from "react";
import { useMediaFolderFilesQuery } from "./useMediaFolderFilesQuery";
import { useMediaMetadataQuery } from "./mediaMetadata";
import { findFilesByExtensions } from "@/lib/music";
import { extensions } from "@smm/types/mediaFileExtensions";
import { basename } from "@/lib/path";
import {
    findNfos,
    findSubtitles,
    findThumbnails,
} from "@/lib/tvShowEpisodeAssociatedFiles";
import type { MediaFileMetadata, MediaMetadata } from "@smm/types/types";
import type { Plan } from "@/api/getPlans";

const INIT_METADATA_FILES: MetadataFiles = {
    nfoPath: undefined,
    posterPath: undefined,
    fanartPath: undefined,
    seasonPosters: [],
    clearlogoPath: undefined,
    themePath: undefined,
};

function findMetadataFiles(metadata: MediaMetadata, files: string[]) {
    const images = findFilesByExtensions(files, extensions.imageFileExtensions)

    return {
        nfoPath: files.find(f => f === `${metadata.mediaFolderPath}/tvshow.nfo`),
        posterPath: images.find(f => {
            return basename(f)?.toLowerCase().includes('poster');
        }),
        fanartPath: images.find(f => {
            return basename(f)?.toLowerCase().includes('fanart');
        }),
        // TODO: support in the future
        seasonPosters: [],
        clearlogoPath: images.find(f => {
            return basename(f)?.toLowerCase().includes('clearlogo');
        }),
        themePath: findFilesByExtensions(files, extensions.musicFileExtensions)
            .find(f => {
                return basename(f)?.toLowerCase().includes('theme');
            }),
    }
}

function hasSeasonEpisode(
    mediaFile: MediaFileMetadata,
): mediaFile is MediaFileMetadata & { seasonNumber: number; episodeNumber: number } {
    return mediaFile.seasonNumber !== undefined && mediaFile.episodeNumber !== undefined
}

export function useTvShowPanel(folderPath: string | undefined, plan: Plan | undefined) {
    const metadataQuery = useMediaMetadataQuery(folderPath)
    const filesQuery = useMediaFolderFilesQuery(folderPath)

    const metadataFiles: MetadataFiles = useMemo(() => {
        if (folderPath === undefined
            || metadataQuery.data === undefined
            || metadataQuery.isError
            || metadataQuery.isPending
            || metadataQuery.fetchStatus !== 'idle'
            || metadataQuery.data === null
            || filesQuery.data === undefined
            || filesQuery.isError
            || filesQuery.isPending
            || filesQuery.fetchStatus !== 'idle'
        ) {
            return INIT_METADATA_FILES;
        }

        const files = filesQuery.data
        const metadata = metadataQuery.data
        return findMetadataFiles(metadata, files)

    }, [
        folderPath,
        metadataQuery.data,
        metadataQuery.isError,
        metadataQuery.isPending,
        metadataQuery.fetchStatus,
        filesQuery.data,
        filesQuery.isError,
        filesQuery.isPending,
        filesQuery.fetchStatus,
    ])

    const subtitleFiles: { season: number, episode: number, files: string[] }[] = useMemo(() => {
        if (metadataQuery.data === undefined || filesQuery.data === undefined) {
            return []
        }

        return metadataQuery.data.mediaFiles
            ?.filter(hasSeasonEpisode)
            ?.map((mediaFile) => ({
                season: mediaFile.seasonNumber,
                episode: mediaFile.episodeNumber,
                files: findSubtitles(filesQuery.data, mediaFile.absolutePath),
            })) ?? []
    }, [metadataQuery.data, filesQuery.data])

    const nfoFiles: { season: number, episode: number, files: string[] }[] = useMemo(() => {
        if (metadataQuery.data === undefined || filesQuery.data === undefined) {
            return []
        }

        return metadataQuery.data.mediaFiles
            ?.filter(hasSeasonEpisode)
            ?.map((mediaFile) => ({
                season: mediaFile.seasonNumber,
                episode: mediaFile.episodeNumber,
                files: findNfos(filesQuery.data, mediaFile.absolutePath),
            })) ?? []
    }, [metadataQuery.data, filesQuery.data])

    const thumbnailFiles: { season: number, episode: number, files: string[] }[] = useMemo(() => {
        if (metadataQuery.data === undefined || filesQuery.data === undefined) {
            return []
        }

        return metadataQuery.data.mediaFiles
            ?.filter(hasSeasonEpisode)
            ?.map((mediaFile) => ({
                season: mediaFile.seasonNumber,
                episode: mediaFile.episodeNumber,
                files: findThumbnails(filesQuery.data, mediaFile.absolutePath),
            })) ?? []
    }, [metadataQuery.data, filesQuery.data])

    const newFilePaths: { season: number, episode: number, newFilePath: string }[] = useMemo(() => {
        if (plan === undefined) {
            return [];
        }

        console.log(`Detected plan: `, plan)

        if (plan.task === 'rename-files') {
            return plan.files
                .map(file => {
                    // If rename-files plan is built wrongly
                    // The plan may try to rename the episode that does not exist
                    const episode = metadataQuery.data?.mediaFiles?.find(mediaFile => mediaFile.absolutePath === file.from)
                    return {
                        season: episode?.seasonNumber ?? -1,
                        episode: episode?.episodeNumber ?? -1,
                        newFilePath: file.to
                    }
                })
                .filter(file => file.season !== -1 && file.episode !== -1)
        }

        if (plan.task === 'recognize-media-file') {
            return plan.files.map(file => {
                return {
                    season: file.season,
                    episode: file.episode,
                    newFilePath: file.path
                }
            })
        }

        console.warn(`Unsupported type of plan`)
        return [];
    }, [plan, metadataQuery.data])

    return {
        metadataFiles,
        subtitleFiles,
        nfoFiles,
        thumbnailFiles,
        newFilePaths,
    }
}
