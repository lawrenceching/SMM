import { recognizeMediaFolder } from "./lib/recognizeMediaFolder"
import { getTvShowById } from "./api/tmdb"
import { Path } from "@core/path";
import type { UIMediaMetadata } from "./types/UIMediaMetadata";
import { recognizeMediaFilesByRules } from "./components/TvShowPanelUtils";
import { lookup } from "./lib/lookup";
import { recognizeMediaFiles } from "./lib/recognizeMediaFiles";

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

  const folderPathInPlatformFormat = Path.toPlatformPath(_in_mm.mediaFolderPath!)

  const mm = await recognizeMediaFolder(_in_mm);
  const traceId = options?.traceId || `doPreprocessMediaFolder`

  if(mm?.type === 'tvshow-folder' && mm?.tmdbTvShow !== undefined) {

    console.log(`[${traceId}] recognizing media files by rules`)
    const recognizedMediaFiles = recognizeMediaFiles(mm)
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
    options?.onSuccess?.(mm)
  } else if(mm?.type === 'movie-folder' && mm?.tmdbMovie !== undefined) {
    options?.onSuccess?.(mm)
  } else {
    options?.onSuccess?.(_in_mm)
  }

}
