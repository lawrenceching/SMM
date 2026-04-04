import type { MovieMediaMetadata, TMDBMovie, TMDBTVShow, TvShowMediaMetadata } from "@core/types";

export interface RecognizeMediaFolderResult {
    success: boolean;
    type?: 'tv' | 'movie' | null;
    tmdbTvShow?: TMDBTVShow;
    tmdbMovie?: TMDBMovie;
    tvdbTvShow?: TvShowMediaMetadata;
    tvdbMovie?: MovieMediaMetadata;
}
