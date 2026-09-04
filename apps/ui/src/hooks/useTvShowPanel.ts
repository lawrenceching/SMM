import type { MetadataFiles } from "@smm/types/MetadataFiles";
import { useMemo, useState } from "react";
import { useMediaFolderFilesQuery } from "./useMediaFolderFilesQuery";
import { useMediaMetadataQuery } from "./mediaMetadata";
import { findFilesByExtensions } from "@/lib/music";
import { extensions, imageFileExtensions, subtitleFileExtensions } from "@smm/types/mediaFileExtensions";
import { basename, extname } from "@/lib/path";
import type { MediaMetadata } from "@smm/types/types";
import { usePlansQuery } from "./plans";
import { Path } from "@smm/utils/path";
import type { Plan } from "@/api/getPlans";

const INIT_METADATA_FILES: MetadataFiles = {
    nfoPath: undefined,
    posterPath: undefined,
    fanartPath: undefined,
    seasonPosters: [],
    clearlogoPath: undefined,
    themePath: undefined,
};

export function findMetadataFiles(metadata: MediaMetadata, files: string[]) {
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

export function findThumbnails(files: string[], videoFile: string): string[] {
    const videoFileExt = extname(videoFile)
    const possibleThumbnailFilePaths = imageFileExtensions.map(ext => `${videoFile.replace(videoFileExt, ext)}`)
    return files.filter(file => possibleThumbnailFilePaths.includes(file))
}

export function findSubtitles(files: string[], videoFile: string): string[] {
    const videoFileExt = extname(videoFile)
    const possibleSubtitleFilePaths = subtitleFileExtensions.map(ext => `${videoFile.replace(videoFileExt, ext)}`)
    return files.filter(file => possibleSubtitleFilePaths.includes(file))
}

export function findNfos(files: string[], videoFile: string): string[] {
    const videoFileExt = extname(videoFile)
    const nfoFilePath = `${videoFile.replace(videoFileExt, '.nfo')}`
    return files.filter(file => file === nfoFilePath)
}

export function useTvShowPanel(folderPath: string | undefined, plan: Plan | undefined) {

    if (folderPath === undefined) {
        return {
            metadataFiles: INIT_METADATA_FILES
        }
    }

    const metadataQuery = useMediaMetadataQuery(folderPath)
    const filesQuery = useMediaFolderFilesQuery(folderPath)

    const metadataFiles: MetadataFiles = useMemo(() => {

        if (metadataQuery.data === undefined
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

    }, [metadataQuery.data, filesQuery.data])

    const subtitleFiles: { season: number, episode: number, files: string[] }[] = useMemo(() => {

        if (metadataQuery.data === undefined
            || filesQuery.data === undefined
        ) {
            return []
        }

        return metadataQuery.data?.mediaFiles
            ?.filter((mediaFile) => mediaFile.seasonNumber !== undefined && mediaFile.episodeNumber !== undefined)
            ?.map((mediaFile) => {
                return {
                    season: mediaFile.seasonNumber!!,
                    episode: mediaFile.episodeNumber!!,
                    files: findSubtitles(filesQuery.data, mediaFile.absolutePath)
                }
            }) ?? []

    }, [metadataQuery.data, filesQuery.data])

    const nfoFiles: { season: number, episode: number, files: string[] }[] = useMemo(() => {

        if (metadataQuery.data === undefined
            || filesQuery.data === undefined
        ) {
            return []
        }

        return metadataQuery.data?.mediaFiles
            ?.filter((mediaFile) => mediaFile.seasonNumber !== undefined && mediaFile.episodeNumber !== undefined)
            ?.map((mediaFile) => {
                return {
                    season: mediaFile.seasonNumber!!,
                    episode: mediaFile.episodeNumber!!,
                    files: findNfos(filesQuery.data, mediaFile.absolutePath)
                }
            }) ?? []

    }, [metadataQuery.data, filesQuery.data])

    const thumbnailFiles: { season: number, episode: number, files: string[] }[] = useMemo(() => {

        if (metadataQuery.data === undefined
            || filesQuery.data === undefined
        ) {
            return []
        }

        return metadataQuery.data?.mediaFiles
            ?.filter((mediaFile) => mediaFile.seasonNumber !== undefined && mediaFile.episodeNumber !== undefined)
            ?.map((mediaFile) => {
                return {
                    season: mediaFile.seasonNumber!!,
                    episode: mediaFile.episodeNumber!!,
                    files: findThumbnails(filesQuery.data, mediaFile.absolutePath)
                }
            }) ?? []

    }, [metadataQuery.data, filesQuery.data])

    const newFilePaths: { season: number, episode: number, newFilePath: string }[] = useMemo(() => {

        if(plan === undefined) {
            return [];
        }

        console.log(`Detected plan: `, plan)

        if(plan.task === 'rename-files') {
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

        if(plan.task === 'recognize-media-file') {
            return plan.files.map(file => {
                return {
                    season: file.season,
                    episode: file.episode,
                    newFilePath: file.path
                }
            })
        }

        console.warn(`Unsupported type of plan: ${plan.task}`)
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