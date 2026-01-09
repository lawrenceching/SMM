import type { SeasonModel } from "./TvShowPanel";


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

export async function recognizeEpisodes(seasons: SeasonModel[]) {
    const mapping = _buildMappingFromSeasonModels(seasons);
    console.log(`[TvShowPanelUtils] recognized episodes:`, mapping);

}