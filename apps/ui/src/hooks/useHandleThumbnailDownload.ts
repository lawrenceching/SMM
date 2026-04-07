import { useCallback } from "react"
import type { MediaFileMetadata, MediaMetadata, TmdbSeasonDetails } from "@core/types"
import { downloadThumbnail, downloadSeasonPoster } from "@/lib/utils"
import { toast } from "sonner"
import { isError, ExistedFileError } from "@core/errors"
import { useTranslation } from "@/lib/i18n"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { getMovieById, getSeason, getTMDBImageUrl, getTvShowById } from "@/api/tmdb"
import { getTVDBv4Client } from "@/lib/TvdbUtils"
import { useTmdbQueries } from "./useTmdbQueries"
import { downloadImageApi } from "@/api/downloadImage"
import { basename, dirname, extname, join, newFilePathWithExt, parse } from "@/lib/path"
import { Path } from "@core/path"
import type { TVDBv4Season } from "@smm/tvdb4/types"

import Debug from 'debug'
const debug = Debug('useHandleThumbnailDownload')

export function useHandleThumbnailDownload() {
    const { t } = useTranslation('dialogs')
    const { getTvShowById, getTvShowSeasonDetails } = useTmdbQueries();

    const getEpisodeStillPathsFromTMDB = useCallback(async (seriesId: number) => {
        const tvshow = await getTvShowById(seriesId, 'en-US');

        const stillPaths: {
            season: number,
            episode: number,
            stillPath: string,
        }[] = [];
        
        for(const season of tvshow.seasons) {
            const tmdbSeason = await getTvShowSeasonDetails(seriesId, season.season_number, 'en-US');
            for(const episode of (tmdbSeason.episodes ?? [])) {

                if(episode.still_path === undefined) {
                    continue;
                }

                const stillImageURL = await getTMDBImageUrl(episode.still_path || '');

                if(stillImageURL === null) {
                    continue;
                }

                stillPaths.push({
                    season: season.season_number,
                    episode: episode.episode_number,
                    stillPath: stillImageURL,
                })
            }
        }

        console.log(`Get still paths for episodes: `, stillPaths)
        return stillPaths;
    }, []);

    const downloadImageMutation = useMutation({
        mutationFn: async ({ url, pathInPosix }: { url: string; pathInPosix: string }) => {
            return await downloadImageApi(url, pathInPosix);
        },
    })

    const handleThumbnailDownload = useCallback(async (mediaMetadata: MediaMetadata) => {

        if(mediaMetadata.type === 'tvshow-folder') {

            const tvShow = mediaMetadata.tvShow;
            if(tvShow === undefined) {
                console.error("Thumbnail download skipped: TV show is undefined")
                return;
            }

            if(tvShow.database === 'TMDB') {
                const tvShowId = parseInt(tvShow.id);
                const stillPaths = await getEpisodeStillPathsFromTMDB(tvShowId);

                for(const mediaFile of mediaMetadata.mediaFiles ?? []) {
                    const stillPath = stillPaths.find((path) => path.season === mediaFile.seasonNumber && path.episode === mediaFile.episodeNumber);
                    if(stillPath === undefined) {
                        continue;
                    }
                    const stillFilePath = newFilePathWithExt(mediaFile.absolutePath, extname(stillPath.stillPath));
                    await downloadImageMutation.mutateAsync({ url: stillPath.stillPath, pathInPosix: stillFilePath });
                }

            } else if(tvShow.database === 'TVDB') {
                const tvShowId = parseInt(tvShow.id);
                const tvdb = getTVDBv4Client();

                const artworkTypesResp = await tvdb.getArtworkTypes();
                if(artworkTypesResp.data === undefined) {
                    console.error("Thumbnail download skipped: artwork types are undefined")
                    return;
                }
                const artworkTypes = artworkTypesResp.data;
                console.log(`Get artwork types: `, artworkTypes)

                /**
                 * See "docs\tvdb\example\artwork_types.jsonl" for example of arkwork types API response
                 */
                const screencapTypeId = artworkTypes.find((type) => type.name === '16:9 Screencap')?.id ?? 11;


                const tvdbTvShow = await tvdb.seriesExtendedById(tvShowId);

                const stillPaths: {
                    season: number,
                    episode: number,
                    stillPath: string,
                }[] = [];
                for(const season of tvdbTvShow.data.seasons ?? []) {
                    const tvdbSeason = await tvdb.seasonExtendedById(season.id);
                    for(const episode of tvdbSeason.data.episodes ?? []) {
                        if(episode.image === undefined) {
                            continue;
                        }
                        if(episode.imageType !== screencapTypeId) {
                            continue;
                        }
                        stillPaths.push({
                            season: season.number,
                            episode: episode.number,
                            stillPath: episode.image,
                        })
                    }
                }

                console.log(`Get still paths for episodes: `, stillPaths)
                for(const mediaFile of mediaMetadata.mediaFiles ?? []) {
                    const stillPath = stillPaths.find((path) => path.season === mediaFile.seasonNumber && path.episode === mediaFile.episodeNumber);
                    if(stillPath === undefined) {
                        debug(`No still path found for episode S${mediaFile.seasonNumber?.toString().padStart(2, '0')}E${mediaFile.episodeNumber?.toString().padStart(2, '0')}`)
                        continue;
                    }
                    const stillFilePath = newFilePathWithExt(mediaFile.absolutePath, extname(stillPath.stillPath));
                    debug(`started to download thumbnail for S${mediaFile.seasonNumber?.toString().padStart(2, '0')}E${mediaFile.episodeNumber?.toString().padStart(2, '0')}: ${stillPath.stillPath}`)
                    await downloadImageMutation.mutateAsync({ url: stillPath.stillPath, pathInPosix: stillFilePath });
                    debug(`downloaded thumbnail for S${mediaFile.seasonNumber?.toString().padStart(2, '0')}E${mediaFile.episodeNumber?.toString().padStart(2, '0')}: ${stillFilePath}`)
                }
            } else {
                console.warn("Thumbnail download skipped: unsupported database " + tvShow.database)
                return;
            }

            

        } else if(mediaMetadata.type === 'movie-folder') {

            const movie = mediaMetadata.movie;
            if(movie === undefined) {
                console.error("Thumbnail download skipped: Movie is undefined")
                return;
            }

            if(movie.database === 'TMDB') {
                const movieId = parseInt(movie.id);
                const tmdbMovie = await getMovieById(movieId, 'en-US');
                // TODO:
            } else if(movie.database === 'TVDB') {
                const movieId = parseInt(movie.id);
                const tvdb = getTVDBv4Client();
                const tvdbMovie = await tvdb.movieExtendedById(movieId);
                // TODO:
            } else {
                console.warn("Thumbnail download skipped: unsupported database " + movie.database)
                return;
            }

        } else {
            console.warn("Thumbnail download skipped: unsupported folder type " + mediaMetadata.type)
            return;
        }

        const fileAlreadyExistsMessage = t('errors.fileAlreadyExists' as any)
        try {
            // await startToDownloadThumbnails(mediaMetadata, () => fileAlreadyExistsMessage)
        } catch (error) {
            console.error("Thumbnail download error:", error)
            throw error // Re-throw so the task handler can mark the task as failed
        }
    }, [t])

    return handleThumbnailDownload
}


