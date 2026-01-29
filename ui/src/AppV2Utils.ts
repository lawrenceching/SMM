import { preprocessMediaFolder } from "./lib/preProcessMediaFolder"
import type { MediaMetadata } from "@core/types"
import { getTvShowById } from "./api/tmdb"

/**
 * For a folder name like:
 * XXX (tmdbid=123456)
 * XXX {tmdbid=123456}
 *
 * This method will extract and return the TMDB ID
 */
export function getTmdbIdFromFolderName(folderName: string): string | null {
  // Match patterns like (tmdbid=123456) or {tmdbid=123456}
  const match = folderName.match(/[\(\{]\s*tmdbid\s*=\s*(\d+)\s*[\}\)]/i);
  return match ? match[1] : null;
}

export async function doPreprocessMediaFolder(
  filePath: string,
  traceId: string,
  selectedMediaMetadata: MediaMetadata | undefined,
  updateMediaMetadata: (path: string, metadata: MediaMetadata, options?: { traceId?: string }) => void
) {
  const result = await preprocessMediaFolder(filePath)

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

      updateMediaMetadata(filePath, {
        ...selectedMediaMetadata,
        tmdbTvShow: response.data,
        type: 'tvshow-folder',
      }, { traceId })

      
    } else if(result.type === 'movie') {
      updateMediaMetadata(filePath, {
        ...selectedMediaMetadata,
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