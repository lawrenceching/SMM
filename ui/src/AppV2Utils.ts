import { preProcessMediaFolder } from "./lib/preProcessMediaFolder"
import type { MediaMetadata, TMDBMovie, TMDBTVShowDetails } from "@core/types"
import { getTvShowById } from "./api/tmdb"
import { minimize } from "./lib/log";
import { Path } from "@core/path";
import type { UIMediaMetadata } from "./types/UIMediaMetadata";
import { delay } from "es-toolkit";

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

export interface doPreprocessMediaFolderOnSuccessCallbackOptions {
  tmdbTvShow?: TMDBTVShowDetails;
  tmdbMovie?: TMDBMovie;
}



export async function doPreprocessMediaFolder(
  folderPathInPlatform: string,
  options?: { traceId?: string, onSuccess?: (options: doPreprocessMediaFolderOnSuccessCallbackOptions) => void, onError?: (error: Error) => void }
) {
  const result = await preProcessMediaFolder(folderPathInPlatform);
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

      console.log(`[${traceId}] successful recognized media folder, update media metadata`, {
        folder: folderPathInPlatform,
        tmdbId: result.tmdbTvShow?.id,
        tvShowName: result.tmdbTvShow?.name,
      })
      options?.onSuccess?.({ tmdbTvShow: response.data })
    } else if(result.type === 'movie') {
      options?.onSuccess?.({ tmdbMovie: result.tmdbMovie })
    } else {
      console.error(`[AppV2Utils] successful recognition result, but the type is null`)
      options?.onError?.(new Error(`unknown media folder type: ${result.type}`))
    }

  } else {
    console.log(`[AppV2Utils] failed to recognize media folder: ${folderPathInPlatform}`)
  }
}
