import type { UIMediaMetadata } from "@/types/UIMediaMetadata";
import { isNil, isNotNil } from "es-toolkit";
import { lookup } from "./lookup";

export function recognizeMediaFiles(mm: UIMediaMetadata): {
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