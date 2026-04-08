import { useMutation, type UseMutationOptions } from "@tanstack/react-query"
import { downloadImageApi } from "@/api/downloadImage"
import { getTMDBImageUrl } from "@/api/tmdb"
import { join } from "@/lib/path"
import { checkFileExists } from "@/lib/utils"
import { useTmdbQueries } from "@/hooks/useTmdbQueries"
import { useTvdbQueries } from "@/hooks/useTvdbQueries"
import type { MediaMetadata, PreferMediaLanguage, TmdbMovieDetails, TmdbSeriesDetails } from "@core/types"
import type { TVDBv4Artwork, TVDBv4MovieBaseRecord, TVDBv4SeriesExtendedResponse } from "@smm/tvdb4/types"

export interface ScrapePosterMutationVariables {
  mediaMetadata: MediaMetadata
  language?: PreferMediaLanguage
}

interface ResolvePosterDeps {
  getTvShowById: (id: number, language?: PreferMediaLanguage) => Promise<TmdbSeriesDetails>
  getMovieById: (id: number, language?: PreferMediaLanguage) => Promise<TmdbMovieDetails>
  getSeriesExtended: (seriesId: number) => Promise<TVDBv4SeriesExtendedResponse | undefined>
  getMovieExtended: (movieId: number) => Promise<TVDBv4MovieBaseRecord | undefined>
}

function toImageUrl(record: unknown): string | undefined {
  return typeof record === "string" && record.trim().length > 0 ? record : undefined
}

function parseTvdbArtworks(record: unknown): TVDBv4Artwork[] {
  if (!Array.isArray(record)) return []
  return record.filter((item): item is TVDBv4Artwork => {
    if (typeof item !== "object" || item === null) return false
    const image = (item as { image?: unknown }).image
    return typeof image === "string" && image.length > 0
  })
}

function pickBestArtworkImage(artworks: TVDBv4Artwork[]): string | undefined {
  const sorted = [...artworks].sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
  return sorted[0]?.image
}

function fileExtensionFromUrl(url: string): string {
  const matched = url.match(/\.([a-zA-Z0-9]{2,5})(?:[?#].*)?$/)
  return matched?.[1]?.toLowerCase() || "jpg"
}

export async function resolvePosterUrl(
  variables: ScrapePosterMutationVariables,
  deps: ResolvePosterDeps,
): Promise<string | undefined> {
  const { mediaMetadata, language } = variables
  if (!mediaMetadata.mediaFolderPath) return undefined

  if (mediaMetadata.type === "tvshow-folder") {
    const tvShow = mediaMetadata.tvShow
    if (!tvShow) return undefined
    const id = Number.parseInt(tvShow.id, 10)
    if (!Number.isFinite(id)) return undefined

    if (tvShow.database === "TMDB") {
      const series = await deps.getTvShowById(id, language)
      return getTMDBImageUrl(series.poster_path, "original") ?? undefined
    }

    if (tvShow.database === "TVDB") {
      const series = await deps.getSeriesExtended(id)
      if (!series) return undefined
      return toImageUrl(series.image) || pickBestArtworkImage(series.artworks ?? [])
    }
    return undefined
  }

  if (mediaMetadata.type === "movie-folder") {
    const movie = mediaMetadata.movie
    if (!movie) return undefined
    const id = Number.parseInt(movie.id, 10)
    if (!Number.isFinite(id)) return undefined

    if (movie.database === "TMDB") {
      const details = await deps.getMovieById(id, language)
      return getTMDBImageUrl(details.poster_path, "original") ?? undefined
    }

    if (movie.database === "TVDB") {
      const record = await deps.getMovieExtended(id)
      if (!record) return undefined
      const baseImage = toImageUrl((record as Record<string, unknown>).image)
      if (baseImage) return baseImage
      return pickBestArtworkImage(parseTvdbArtworks((record as Record<string, unknown>).artworks))
    }
  }

  return undefined
}

export function useScrapePosterMutation<TContext = unknown>(
  options?: Omit<
    UseMutationOptions<void, Error, ScrapePosterMutationVariables, TContext>,
    "mutationFn"
  >
) {
  const { getTvShowById, getMovieById } = useTmdbQueries()
  const { getSeriesExtended, getMovieExtended } = useTvdbQueries()

  return useMutation({
    ...options,
    mutationFn: async (variables: ScrapePosterMutationVariables) => {
      const { mediaMetadata } = variables
      if (!mediaMetadata.mediaFolderPath) return
      const posterUrl = await resolvePosterUrl(variables, {
        getTvShowById,
        getMovieById,
        getSeriesExtended,
        getMovieExtended,
      })
      if (!posterUrl) return

      const ext = fileExtensionFromUrl(posterUrl)
      const posterPath = join(mediaMetadata.mediaFolderPath, `poster.${ext}`)
      const exists = await checkFileExists(posterPath)
      if (exists) return

      const response = await downloadImageApi(posterUrl, posterPath)
      if (response.error) {
        throw new Error(response.error)
      }
    },
  })
}

