import { recognizeMediaFolder } from "./lib/recognizeMediaFolder"
import { Path } from "@core/path";
import { basename } from "./lib/path"
import type { MediaFolderListItemV2Props } from "./components/sidebar/MediaFolderListItemV2"
import type { UIMediaMetadata } from "./types/UIMediaMetadata";
import { recognizeMovieMediaFiles } from "./lib/recognizeMediaFiles";
import { recognizeEpisodesAsync } from "./lib/recognizeEpisodes";
import type { PreferMediaLanguage, PrimaryDatabase, TmdbSearchResponseBody, TvShowMediaMetadata } from "@core/types";
import type { TVDBv4SearchParams, TVDBv4SearchResult } from "@smm/tvdb4";

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

export function buildMediaFolderListItemV2PropsByUIMediaMetadatas(
  mediaMetadatas: UIMediaMetadata[]
): MediaFolderListItemV2Props[] {
  return mediaMetadatas.map((metadata) => {

    const getMediaName = () => {
      if(metadata.tvShow) {
        return metadata.tvShow.name;
      } else if(metadata.movie) {
        return metadata.movie.name;
      } else {
        return basename(metadata.mediaFolderPath!) ?? "未识别媒体名称";
      }
    }

    return {
      mediaName: getMediaName(),
      path: metadata.mediaFolderPath,
      mediaType:
        metadata.type === "tvshow-folder"
          ? "tvshow"
          : metadata.type === "movie-folder"
            ? "movie"
            : "tvshow-folder",
      status: metadata.status,
    } as MediaFolderListItemV2Props
  })
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

/**
 * @param _in_mm 
 * @param options 
 */
export async function doPreprocessMediaFolder(
  _in_mm: UIMediaMetadata,
  options: { 
    traceId?: string, 
    preferLanguage?: PreferMediaLanguage,
    /** Preferred metadata DB for id-in-name and folder-name fallbacks. Undefined: try TMDB, then TVDB. */
    primaryDatabase?: PrimaryDatabase,
    onSuccess?: (mm: UIMediaMetadata) => void, 
    onError?: (error: Error) => void,
    getTvShowByIdFromTmdbFn: (id: number, language?: PreferMediaLanguage) => Promise<TvShowMediaMetadata>,
    getTvShowByIdFromTvdbFn: (
      seriesId: number,
      language?: PreferMediaLanguage
    ) => Promise<TvShowMediaMetadata>,
    searchInTmdbFn?: (query: string, type: "tv" | "movie") => Promise<TmdbSearchResponseBody>,
    searchInTvdbFn?: (params: TVDBv4SearchParams) => Promise<TVDBv4SearchResult[] | undefined>,
  }
) {

  const traceId = options?.traceId || `MediaFolderInitialization`

  console.log(`[${traceId}] doPreprocessMediaFolder CALLED: folder=${_in_mm.mediaFolderPath}, preferLanguage=${options?.preferLanguage}, primaryDatabase=${options?.primaryDatabase}`)

  const getTvShowByIdFromTmdbFn = options?.getTvShowByIdFromTmdbFn;
  const getTvShowByIdFromTvdbFn = options?.getTvShowByIdFromTvdbFn;
  const searchInTmdbFn = options?.searchInTmdbFn;
  const searchInTvdbFn = options?.searchInTvdbFn;
  const folderPathInPlatformFormat = Path.toPlatformPath(_in_mm.mediaFolderPath!)

  const mm = await recognizeMediaFolder(
    _in_mm,
    getTvShowByIdFromTmdbFn,
    getTvShowByIdFromTvdbFn,
    searchInTmdbFn,
    searchInTvdbFn,
    options?.preferLanguage,
    options?.primaryDatabase,
  );

  if(mm?.type === 'tvshow-folder') {

    if(mm.tvShow !== undefined && (mm.tvShow.seasons === undefined || mm.tvShow.seasons.length === 0)) {
      
      try {

        
      if(mm.tvShow.database === "TMDB") {
        console.log(`[${traceId}] TV show has no seasons, try to get all seasons by TMDB ID: ${mm.tvShow.id}`)
        const tvShow = await getTvShowByIdFromTmdbFn(parseInt(mm.tvShow.id), options?.preferLanguage ?? 'en-US');
        if(tvShow) {
          mm.tvShow = tvShow;
        }
      } else if(mm.tvShow.database === "TVDB") {
        try {
          const tvShow = await getTvShowByIdFromTvdbFn(
            parseInt(mm.tvShow.id, 10),
            options?.preferLanguage ?? "en-US",
          )
          mm.tvShow = tvShow
        } catch (error) {
          console.error(
            `[${traceId}] failed to get TV show from TVDB by ID: ${mm.tvShow!.id}`,
            error,
          )
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
