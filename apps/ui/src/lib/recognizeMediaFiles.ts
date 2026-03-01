import type { UIMediaMetadata } from "@/types/UIMediaMetadata";
import { isNil, isNotNil } from "es-toolkit";
import { lookup } from "./lookup";
import { findVideoFiles } from "./MovieMediaMetadataUtils";

export function recognizeTvShowMediaFiles(mm: UIMediaMetadata): {
    season: number,
    episode: number,
    videoFilePath: string,
}[] {
    if(isNil(mm.files)) {
        return [];
    }

    if(isNil(mm.tmdbTvShow)) {
        return [];
    }

    const ret: {
        season: number,
        episode: number,
        videoFilePath: string,
    }[] = [];
    
    mm.tmdbTvShow.seasons.forEach(season => {
        season.episodes?.forEach(episode => {
            const videoFilePath = lookup(mm.files!, season.season_number, episode.episode_number);
            if(isNotNil(videoFilePath)) {
                ret.push({
                    season: season.season_number,
                    episode: episode.episode_number,
                    videoFilePath: videoFilePath,
                });
            }
        });
    });

    return ret;
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