import { preProcessMediaFolder } from "./lib/preProcessMediaFolder"
import type { MediaMetadata } from "@core/types"
import { getTvShowById } from "./api/tmdb"
import { minimize } from "./lib/log";

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
  filePath: string,
  traceId: string,
  updateMediaMetadata: (path: string, metadata: MediaMetadata, options?: { traceId?: string }) => void
) {
  const result = await preProcessMediaFolder(filePath)

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
        folder: filePath,
        tmdbId: result.tmdbTvShow?.id,
        tvShowName: result.tmdbTvShow?.name,
      })
      updateMediaMetadata(filePath, {
        tmdbTvShow: response.data,
        type: 'tvshow-folder',
      }, { traceId })

      
    } else if(result.type === 'movie') {
      updateMediaMetadata(filePath, {
        tmdbMovie: result.tmdbMovie,
        type: 'movie-folder',
      }, { traceId })
    } else {
      console.error(`[AppV2Utils] successful recognition result, but the type is null`)
    }

  } else {
    console.log(`[AppV2Utils] failed to recognize media folder: ${filePath}`)
  }
}
