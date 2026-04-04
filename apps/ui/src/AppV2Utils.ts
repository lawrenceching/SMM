import { recognizeMediaFolder } from "./lib/recognizeMediaFolder"
import { Path } from "@core/path";
import type { UIMediaMetadata } from "./types/UIMediaMetadata";
import { recognizeMovieMediaFiles } from "./lib/recognizeMediaFiles";
import { recognizeEpisodesAsync } from "./lib/recognizeEpisodes";
import type { PreferMediaLanguage } from "@core/types";
import { fetchTvdbAndBuildTvShowMediaMetadata } from "./lib/TvdbUtils";
import { getTvShowByIdFromTMDB } from "./lib/TmdbUtils";

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
 * This is a tmp folder only used before tvShow and tmdbMovie are removed from MediaMetadata
 * @param _in_out_mm 
 */
// function fillTvShowAndMovieBytvShowOrMovie(_in_out_mm: UIMediaMetadata) {
//   if (_in_out_mm.tvShow === undefined && _in_out_mm.tvShow !== undefined) {
//     const details: TvShowMediaMetadata = _in_out_mm.tvShow;
//     const seasons: TvShowSeasonMetadata[] = (details.seasons ?? []).map((season) => {
//       const episodes: TvShowEpisodeMetadata[] = (season.episodes ?? []).map((ep) => ({
//         season: ep.season_number,
//         episode: ep.episode_number,
//         name: ep.name ?? "",
//       }));
//       return {
//         season: season.season_number,
//         name: season.name ?? "",
//         episodes,
//       };
//     });
//     const tvShow: TvShowMediaMetadata = {
//       id: String(details.id),
//       name: details.name,
//       database: "TMDB",
//       seasons,
//     };
//     _in_out_mm.tvShow = tvShow;
//   }

//   if (_in_out_mm.movie === undefined && _in_out_mm.tmdbMovie !== undefined) {
//     const m = _in_out_mm.tmdbMovie;
//     _in_out_mm.movie = {
//       id: String(m.id),
//       name: m.title,
//       database: "TMDB",
//     };
//   }
// }

export async function doPreprocessMediaFolder(
  _in_mm: UIMediaMetadata,
  options?: { traceId?: string, preferLanguage?: PreferMediaLanguage, onSuccess?: (mm: UIMediaMetadata) => void, onError?: (error: Error) => void }
) {

  const traceId = options?.traceId || `doPreprocessMediaFolder`

  const folderPathInPlatformFormat = Path.toPlatformPath(_in_mm.mediaFolderPath!)

  const mm = await recognizeMediaFolder(_in_mm, options?.preferLanguage);

  if(mm?.type === 'tvshow-folder') {

    if(mm.tvShow !== undefined && (mm.tvShow.seasons === undefined || mm.tvShow.seasons.length === 0)) {
      
      try {

        
      if(mm.tvShow.database === "TMDB") {
        console.log(`[${traceId}] TV show has no seasons, try to get all seasons by TMDB ID: ${mm.tvShow.id}`)
        const tvShow = await getTvShowByIdFromTMDB(parseInt(mm.tvShow.id), options?.preferLanguage ?? 'en-US');
        if(tvShow) {
          mm.tvShow = tvShow;
        }
      } else if(mm.tvShow.database === "TVDB") {
        const tvShow = await fetchTvdbAndBuildTvShowMediaMetadata(
          parseInt(mm.tvShow.id), 
          options?.preferLanguage ?? 'en-US', {
            onSeasonsAPIError: (error: Error) => {
              console.error(`[${traceId}] failed to get TV show from TVDB by ID: ${mm.tvShow!.id}`, error)
            },
            onSeriesAPIError: (error: Error) => {
              console.error(`[${traceId}] failed to get TV show from TVDB by ID: ${mm.tvShow!.id}`, error)
            },
        });
        if(tvShow) {
          mm.tvShow = tvShow;
        }
      } else {
        console.warn(`[${traceId}] TV show has no seasons, but database is not TMDB or TVDB, skip`)
      }

      } catch (error) {
        console.error(`[${traceId}] failed to get TV show from TMDB or TVDB by ID: ${mm.tvShow!.id}`, error)
      }


    }

    // fillTvShowAndMovieBytvShowOrMovie(mm);

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
      tmdbId: mm.tvShow?.id,
      tvShowName: mm.tvShow?.name || mm.tvShow?.name,
      mediaFiles: mm.mediaFiles,
    })

    options?.onSuccess?.(mm)
  } else if(mm?.type === 'movie-folder') {

    // fillTvShowAndMovieBytvShowOrMovie(mm)

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
