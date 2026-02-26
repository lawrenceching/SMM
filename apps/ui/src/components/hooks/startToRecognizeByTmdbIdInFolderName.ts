import type { UIMediaMetadata } from "@/types/UIMediaMetadata"
import type { UserConfig } from "@core/types"
import { getTmdbIdFromFolderName } from "@/AppV2Utils"

export interface TmdbIdDetectionResult {
  tmdbId: number
  language: 'zh-CN' | 'en-US' | 'ja-JP'
}

export function startToRecognizeByTmdbIdInFolderName(
  mediaMetadata: UIMediaMetadata | undefined,
  userConfig: UserConfig | undefined
): TmdbIdDetectionResult | null {
  if (mediaMetadata?.mediaFolderPath === undefined) {
    return null
  }

  if (mediaMetadata.status !== 'ok') {
    return null
  }

  if (mediaMetadata.tmdbTvShow !== undefined) {
    return null
  }

  const tmdbIdString = getTmdbIdFromFolderName(mediaMetadata.mediaFolderPath)
  if (tmdbIdString === null) {
    return null
  }

  const tmdbIdNumber = parseInt(tmdbIdString, 10)
  if (isNaN(tmdbIdNumber) || tmdbIdNumber <= 0) {
    return null
  }

  const language = (userConfig?.applicationLanguage || 'en-US') as 'zh-CN' | 'en-US' | 'ja-JP'

  return {
    tmdbId: tmdbIdNumber,
    language,
  }
}
