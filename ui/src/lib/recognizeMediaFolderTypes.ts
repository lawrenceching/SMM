import type { TMDBMovie, TMDBTVShow } from "@core/types";

export interface RecognizeMediaFolderResult {
    success: boolean;
    type?: 'tv' | 'movie' | null;
    tmdbTvShow?: TMDBTVShow;
    tmdbMovie?: TMDBMovie;
}
