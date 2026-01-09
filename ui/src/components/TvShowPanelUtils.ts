import type { SeasonModel } from "./TvShowPanel";
import type { MediaMetadata, MediaFileMetadata } from "@core/types";


export function _buildMappingFromSeasonModels(seasons: SeasonModel[]): {seasonNumber: number, episodeNumber: number, videoFilePath: string}[] {
    const mapping: {seasonNumber: number, episodeNumber: number, videoFilePath: string}[] = [];

    for (const season of seasons) {
        for (const episode of season.episodes) {
            // Find the video file for this episode
            const videoFile = episode.files.find(file => file.type === "video");
            
            if (videoFile) {
                mapping.push({
                    seasonNumber: season.season.season_number,
                    episodeNumber: episode.episode.episode_number,
                    videoFilePath: videoFile.path,
                });
            }
        }
    }

    return mapping;
}

export async function recognizeEpisodes(
    seasons: SeasonModel[], 
    mediaMetadata: MediaMetadata, 
    updateMediaMetadata: (path: string, metadata: MediaMetadata) => void) {
    const mapping = _buildMappingFromSeasonModels(seasons);
    console.log(`[TvShowPanelUtils] recognized episodes:`, mapping);

    // Map the recognized episodes to MediaFileMetadata format
    const mediaFiles: MediaFileMetadata[] = mapping.map(item => ({
        absolutePath: item.videoFilePath,
        seasonNumber: item.seasonNumber,
        episodeNumber: item.episodeNumber,
    }));

    // Update mediaMetadata with the new mediaFiles
    const updatedMetadata: MediaMetadata = {
        ...mediaMetadata,
        mediaFiles: mediaFiles,
    };

    // Call updateMediaMetadata to persist the changes
    if (mediaMetadata.mediaFolderPath) {
        updateMediaMetadata(mediaMetadata.mediaFolderPath, updatedMetadata);
    } else {
        console.error(`[TvShowPanelUtils] mediaFolderPath is undefined, cannot update media metadata`);
    }
}