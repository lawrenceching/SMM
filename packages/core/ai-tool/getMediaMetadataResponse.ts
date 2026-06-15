import { Path } from '../path'
import type {
  MediaMetadata,
  MovieMediaMetadata,
  TvShowMediaMetadata,
} from '../types'
import type { GetMediaMetadataResponseData } from '../types/ai-tools/getMediaMetadata'
import { GET_MEDIA_METADATA_UNRECOGNIZED } from '../types/ai-tools/getMediaMetadata'

function parseMediaIdString(id: string): number {
  const n = Number.parseInt(id, 10)
  return Number.isFinite(n) ? n : 0
}

function mapTvShowToResponse(
  tv: TvShowMediaMetadata,
): GetMediaMetadataResponseData['tvShow'] {
  return {
    source: tv.database ?? 'TVDB',
    id: parseMediaIdString(tv.id),
    name: tv.name,
    seasons:
      tv.seasons?.map((season) => ({
        seasonNumber: season.season,
        seasonName: season.name,
        episodes:
          season.episodes?.map((ep) => ({
            seasonNumber: ep.season,
            episodeNumber: ep.episode,
            episodeName: ep.name,
          })) ?? [],
      })) ?? [],
  }
}

function mapTvdbMovieToResponse(
  m: MovieMediaMetadata,
): NonNullable<GetMediaMetadataResponseData['tvdbMovie']> {
  return {
    tvdbId: parseMediaIdString(m.id),
    name: m.name,
    database: m.database,
  }
}

export function createBaseGetMediaMetadataData(
  mediaFolderPath: string,
): GetMediaMetadataResponseData {
  return {
    mediaFolderPath: Path.toPlatformPath(mediaFolderPath),
    type: 'tvshow-folder',
  }
}

/**
 * Build AI tool / MCP `data` payload from cached {@link MediaMetadata}.
 */
export function fillMediaMetadataResponseData(
  metadata: MediaMetadata,
  posixPath: string,
): GetMediaMetadataResponseData {
  const data: GetMediaMetadataResponseData = {
    mediaFolderPath: Path.toPlatformPath(metadata.mediaFolderPath || posixPath),
    type: metadata.type || 'tvshow-folder',
  }

  if (data.type === 'tvshow-folder') {
    if (metadata.tvShow) {
      data.tvShow = mapTvShowToResponse(metadata.tvShow)
    } else {
      data.tvShow = GET_MEDIA_METADATA_UNRECOGNIZED
    }
  } else if (data.type === 'movie-folder') {
    if (metadata.movie) {
      if (metadata.movie.database === 'TMDB') {
        const tmdbId = parseMediaIdString(metadata.movie.id)
        data.tmdbMovie = {
          tmdbId,
          title: metadata.movie.name,
          originalTitle: metadata.movie.name,
          overview: '',
          releaseDate: metadata.movie.airDate ?? '',
          posterPath: null,
        }
        data.tvdbMovie = GET_MEDIA_METADATA_UNRECOGNIZED
      } else {
        data.tvdbMovie = mapTvdbMovieToResponse(metadata.movie)
        data.tmdbMovie = GET_MEDIA_METADATA_UNRECOGNIZED
      }
    } else {
      data.tmdbMovie = GET_MEDIA_METADATA_UNRECOGNIZED
      data.tvdbMovie = GET_MEDIA_METADATA_UNRECOGNIZED
    }
  }

  return data
}
