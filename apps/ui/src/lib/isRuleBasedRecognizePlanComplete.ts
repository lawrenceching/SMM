import type { RecognizedFile } from '@core/types/RecognizeMediaFilePlan'
import type { MediaMetadata } from '@core/types'
import { mediaFilePathEqual } from './mediaFilePathEqual'

function episodeKey(season: number, episode: number): string {
  return `${season}:${episode}`
}

function buildExpectedEpisodes(mediaMetadata: MediaMetadata): { season: number; episode: number }[] {
  if (!mediaMetadata.tvShow?.seasons?.length) {
    return []
  }

  const expected: { season: number; episode: number }[] = []
  for (const season of mediaMetadata.tvShow.seasons) {
    if (!season.episodes?.length) {
      continue
    }
    for (const episode of season.episodes) {
      expected.push({ season: season.season, episode: episode.episode })
    }
  }
  return expected
}

function isEpisodeCovered(
  season: number,
  episode: number,
  files: RecognizedFile[],
  mediaMetadata: MediaMetadata,
): boolean {
  const key = episodeKey(season, episode)
  if (files.some((f) => episodeKey(f.season, f.episode) === key)) {
    return true
  }
  return mediaMetadata.mediaFiles?.some(
    (f) => f.seasonNumber === season && f.episodeNumber === episode,
  ) ?? false
}

/**
 * Returns true when every tvShow episode is covered by the plan and/or existing mediaFiles.
 * Uses season.season from metadata (same as the episode table), not episode.season.
 */
export function isRuleBasedRecognizePlanComplete(
  files: RecognizedFile[],
  mediaMetadata: MediaMetadata,
): boolean {
  const expected = buildExpectedEpisodes(mediaMetadata)
  if (expected.length === 0) {
    return false
  }

  return expected.every((ep) => isEpisodeCovered(ep.season, ep.episode, files, mediaMetadata))
}

/**
 * Returns true when every file in the plan already matches the current mediaFiles mapping.
 */
export function isRuleBasedRecognizePlanFullyUnchanged(
  files: RecognizedFile[],
  mediaMetadata: MediaMetadata,
): boolean {
  if (files.length === 0) {
    return false
  }

  return files.every((file) => {
    if (file.path == null) {
      return false
    }
    const existing = mediaMetadata.mediaFiles?.find(
      (mf) => mf.seasonNumber === file.season && mf.episodeNumber === file.episode,
    )
    return existing != null && mediaFilePathEqual(existing.absolutePath, file.path)
  })
}
