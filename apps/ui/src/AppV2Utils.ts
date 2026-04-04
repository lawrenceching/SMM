import { recognizeMediaFolder } from "./lib/recognizeMediaFolder"
import { Path } from "@core/path";
import type { UIMediaMetadata } from "./types/UIMediaMetadata";
import { recognizeMovieMediaFiles } from "./lib/recognizeMediaFiles";
import { getTvShowById } from "./api/tmdb";
import { recognizeEpisodesAsync } from "./lib/recognizeEpisodes";
import type { PreferMediaLanguage, TMDBTVShowDetails, TvShowEpisodeMetadata, TvShowMediaMetadata, TvShowSeasonMetadata } from "@core/types";

/**
 * For a folder name like:
 * XXX (tmdbid=123456)
 * XXX {tmdbid=123456}
 *
 * This method will extract and return the TMDB ID
 */
export function getTmdbIdFromFolderName(folderName: string): string | null {
  // Match patterns like (tmdbid=123456), {tmdbid=123456}, or [tmdbid=123456]
  const match = folderName.match(/[\(\{\[]\s*tmdbid\s*=\s*(\d+)\s*[\}\)\]]/i);
  return match ? match[1] : null;
}

/**
 * This is a tmp folder only used before tmdbTvShow and tmdbMovie are removed from MediaMetadata
 * @param _in_out_mm 
 */
function fillTvShowAndMovieByTmdbTvShowOrMovie(_in_out_mm: UIMediaMetadata) {
  if (_in_out_mm.tvShow === undefined && _in_out_mm.tmdbTvShow !== undefined) {
    const details: TMDBTVShowDetails = _in_out_mm.tmdbTvShow;
    const seasons: TvShowSeasonMetadata[] = (details.seasons ?? []).map((season) => {
      const episodes: TvShowEpisodeMetadata[] = (season.episodes ?? []).map((ep) => ({
        season: ep.season_number,
        episode: ep.episode_number,
        name: ep.name ?? "",
      }));
      return {
        season: season.season_number,
        name: season.name ?? "",
        episodes,
      };
    });
    const tvShow: TvShowMediaMetadata = {
      id: String(details.id),
      name: details.name,
      database: "TMDB",
      seasons,
    };
    _in_out_mm.tvShow = tvShow;
  }

  if (_in_out_mm.movie === undefined && _in_out_mm.tmdbMovie !== undefined) {
    const m = _in_out_mm.tmdbMovie;
    _in_out_mm.movie = {
      id: String(m.id),
      name: m.title,
      database: "TMDB",
    };
  }
}


export async function doPreprocessMediaFolder(
  _in_mm: UIMediaMetadata,
  options?: { traceId?: string, preferLanguage?: PreferMediaLanguage, onSuccess?: (mm: UIMediaMetadata) => void, onError?: (error: Error) => void }
) {

  const traceId = options?.traceId || `doPreprocessMediaFolder`

  const folderPathInPlatformFormat = Path.toPlatformPath(_in_mm.mediaFolderPath!)

  const mm = await recognizeMediaFolder(_in_mm, options?.preferLanguage);

  if(mm?.type === 'tvshow-folder') {

    if(mm.tmdbTvShow !== undefined && (mm.tmdbTvShow.seasons === undefined || mm.tmdbTvShow.seasons.length === 0)) {
      console.log(`[${traceId}] TV show has no seasons, try to get all seasons by TMDB ID: ${mm.tmdbTvShow.id}`)
      const tmdbId = mm.tmdbTvShow.id;
      const resp = await getTvShowById(tmdbId, 'zh-CN');
      if(resp.error) {
          console.error(`[${traceId}][doPreprocessMediaFolder] Error in getTvShowById:`, resp.error)
      } else if(resp.data === undefined) {
          console.error(`[${traceId}][doPreprocessMediaFolder] Error in getTvShowById:`, resp)
      } else {
          console.log(`[${traceId}][doPreprocessMediaFolder] successfully recognized TV show by folder name: ${mm.tmdbTvShow.name} ${mm.tmdbTvShow.id}`)
          mm.tmdbTvShow = resp.data;
      }
    }

    fillTvShowAndMovieByTmdbTvShowOrMovie(mm);

    console.log(`[${traceId}] recognizing media files by rules`)
    // TODO: recognize media files by nfo
    const recognizedMediaFiles = await recognizeEpisodesAsync(mm)
    if (recognizedMediaFiles) {
      mm.mediaFiles = recognizedMediaFiles.map((i) => ({
        absolutePath: i.file,
        seasonNumber: i.season,
        episodeNumber: i.episode,
      }));
    }

    console.log(`[${traceId}] successful recognized media folder, update media metadata`, {
      folder: folderPathInPlatformFormat,
      tmdbId: mm.tmdbTvShow?.id,
      tvShowName: mm.tmdbTvShow?.name || mm.tvShow?.name,
      mediaFiles: mm.mediaFiles,
    })

    options?.onSuccess?.(mm)
  } else if(mm?.type === 'movie-folder') {

    fillTvShowAndMovieByTmdbTvShowOrMovie(mm)

    console.log(`[${traceId}] recognizing media files by rules`)
    const recognizedMediaFiles = recognizeMovieMediaFiles(mm)
    mm.mediaFiles = recognizedMediaFiles.map((i) => ({
      absolutePath: i.videoFilePath,
    }));
    console.log(`[${traceId}] successful recognized media folder, update media metadata`, recognizedMediaFiles);
    options?.onSuccess?.(mm)
  } else {
    options?.onSuccess?.(_in_mm)
  }

}
