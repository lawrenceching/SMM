import { recognizeMediaFolder } from "./lib/recognizeMediaFolder"
import { Path } from "@core/path";
import type { UIMediaMetadata } from "./types/UIMediaMetadata";
import { recognizeMovieMediaFiles, recognizeTvShowMediaFiles } from "./lib/recognizeMediaFiles";
import { getTvShowById } from "./api/tmdb";

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


export async function doPreprocessMediaFolder(
  _in_mm: UIMediaMetadata,
  options?: { traceId?: string, onSuccess?: (mm: UIMediaMetadata) => void, onError?: (error: Error) => void }
) {

  const traceId = options?.traceId || `doPreprocessMediaFolder`

  const folderPathInPlatformFormat = Path.toPlatformPath(_in_mm.mediaFolderPath!)

  const mm = await recognizeMediaFolder(_in_mm);

  if(mm?.type === 'tvshow-folder' && mm?.tmdbTvShow !== undefined) {

    console.log(`[${traceId}] recognizing media files by rules`)
    // TODO: recognize media files by nfo
    const recognizedMediaFiles = recognizeTvShowMediaFiles(mm)
    if (recognizedMediaFiles) {
      mm.mediaFiles = recognizedMediaFiles.map((i) => ({
        absolutePath: i.videoFilePath,
        seasonNumber: i.season,
        episodeNumber: i.episode,
      }));
    }

    console.log(`[${traceId}] successful recognized media folder, update media metadata`, {
      folder: folderPathInPlatformFormat,
      tmdbId: mm.tmdbTvShow?.id,
      tvShowName: mm.tmdbTvShow.name,
      mediaFiles: mm.mediaFiles,
    })

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

    options?.onSuccess?.(mm)
  } else if(mm?.type === 'movie-folder' && mm?.tmdbMovie !== undefined) {
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
