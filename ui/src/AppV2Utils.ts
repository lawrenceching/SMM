import { recognizeMediaFolder } from "./lib/recognizeMediaFolder"
import { getTvShowById } from "./api/tmdb"
import { Path } from "@core/path";
import type { UIMediaMetadata } from "./types/UIMediaMetadata";
import { recognizeMediaFilesByRules } from "./components/TvShowPanelUtils";
import { lookup } from "./lib/lookup";

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
  mm: UIMediaMetadata,
  options?: { traceId?: string, onSuccess?: (mm: UIMediaMetadata) => void, onError?: (error: Error) => void }
) {

  const folderPathInPlatformFormat = Path.toPlatformPath(mm.mediaFolderPath!)

  const result = await recognizeMediaFolder(folderPathInPlatformFormat);
  const traceId = options?.traceId || `doPreprocessMediaFolder`

  if(result.success) {

    if(result.type === 'tv') {

      if(result.tmdbTvShow?.id === undefined) {
        console.error(`[AppV2Utils] successful recognition result, but the tmdbTvShow.id is undefined`)
        return;
      }

      const response = await getTvShowById(result.tmdbTvShow.id, 'zh-CN')

      if(response.error) {
        console.error(`[${traceId}] failed to get TMDB TV show details by TMDB ID from recognition result: ${response.error}`)
        return;
      }

      if(response.data === undefined) {
        console.error(`[${traceId}] failed to get TMDB TV show details by TMDB ID from recognition result: response.data is undefined`)
        return;
      }

      mm.tmdbTvShow = response.data;
      mm.type = 'tvshow-folder';
      
      const recognizedMediaFiles = recognizeMediaFilesByRules(mm, lookup)
      if (recognizedMediaFiles) {
        mm.mediaFiles = recognizedMediaFiles.map((season: any) => ({
          absolutePath: season.videoFilePath,
          seasonNumber: season.season,
          episodeNumber: season.episode,
        }));
      }

      console.log(`[${traceId}] successful recognized media folder, update media metadata`, {
        folder: folderPathInPlatformFormat,
        tmdbId: mm.tmdbTvShow?.id,
        tvShowName: mm.tmdbTvShow.name,
      })
      options?.onSuccess?.(mm)
    } else if(result.type === 'movie') {
      options?.onSuccess?.(mm)
    } else {
      console.error(`[AppV2Utils] successful recognition result, but the type is null`)
      options?.onError?.(new Error(`unknown media folder type: ${result.type}`))
    }

  } else {
    console.log(`[AppV2Utils] failed to recognize media folder: ${folderPathInPlatformFormat}`)
  }
}
