import type { UIMediaMetadata } from "@/types/UIMediaMetadata";
import { isNil, isNotNil } from "es-toolkit";
import { lookup } from "./lookup";
import { findVideoFiles } from "./MovieMediaMetadataUtils";

export type LookupFn = (files: string[], seasonNumber: number, episodeNumber: number) => string | null;

export type RecognizedEpisode = {
    season: number;
    episode: number;
    videoFilePath: string;
};

/**
 * Shared core: iterate tmdbTvShow seasons/episodes, call lookupFn, collect non-null matches.
 * Performs de-duplication by videoFilePath so the same file is not assigned to multiple episodes.
 * Does not build associated files and does not decide []/null policy — callers decide.
 */
export function collectRecognizedEpisodes(
    mm: UIMediaMetadata,
    lookupFn: LookupFn
): RecognizedEpisode[] {
    if (isNil(mm.files) || isNil(mm.tmdbTvShow)) {
        return [];
    }
    const assignedVideoFilePaths = new Set<string>();
    const ret: RecognizedEpisode[] = [];
    mm.tmdbTvShow.seasons.forEach(season => {
        season.episodes?.forEach(episode => {
            const videoFilePath = lookupFn(mm.files!, season.season_number, episode.episode_number);
            if (isNotNil(videoFilePath)) {
                if (assignedVideoFilePaths.has(videoFilePath)) {
                    return;
                }
                assignedVideoFilePaths.add(videoFilePath);
                ret.push({
                    season: season.season_number,
                    episode: episode.episode_number,
                    videoFilePath,
                });
            }
        });
    });
    return ret;
}

export function recognizeTvShowMediaFiles(mm: UIMediaMetadata): RecognizedEpisode[] {
    return collectRecognizedEpisodes(mm, lookup);
}


export function recognizeMovieMediaFiles(mm: UIMediaMetadata): {
    videoFilePath: string,
}[] {
    if(isNil(mm.files)) {
        return [];
    }

    if(isNil(mm.tmdbMovie)) {
        return [];
    }

    const videoFiles = findVideoFiles(mm.files);
    if(videoFiles.length > 0) {
        return [{
            videoFilePath: videoFiles[0],
        }]
    }

    return [];
}