import type { MovieMediaMetadata, TvShowMediaMetadata } from "@core/types";

export interface RecognizeMediaFolderResult {
    success: boolean;
    type?: 'tv' | 'movie' | null;
    tmdbTvShow?: TvShowMediaMetadata;
    tmdbMovie?: MovieMediaMetadata;
    tvdbTvShow?: TvShowMediaMetadata;
    tvdbMovie?: MovieMediaMetadata;
}
