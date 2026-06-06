import { useMutation, type UseMutationOptions } from "@tanstack/react-query"
import { downloadImageApi } from "@/api/downloadImage"
import { getTMDBImageUrl } from "@/api/tmdb"
import { join } from "@/lib/path"
import { checkFileExists } from "@/lib/utils"
import { useTmdbQueries } from "@/hooks/useTmdbQueries"
import { useTvdbQueries } from "@/hooks/useTvdbQueries"
import type { MediaMetadata, TmdbMovieDetails, TmdbSeriesDetails } from "@core/types"
import type {
  TVDBv4Artwork,
  TVDBv4ArtworkTypeRecord,
  TVDBv4MovieBaseRecord,
  TVDBv4SeriesExtendedResponse,
} from "@smm/tvdb4/types"

export interface ScrapeFanartMutationVariables {
  mediaMetadata: MediaMetadata
  language?: string
}

interface ResolveFanartDeps {
  getTvShowById: (id: number, language?: string) => Promise<TmdbSeriesDetails>
  getMovieById: (id: number, language?: string) => Promise<TmdbMovieDetails>
  getSeriesExtended: (seriesId: number) => Promise<TVDBv4SeriesExtendedResponse | undefined>
  getMovieExtended: (movieId: number) => Promise<TVDBv4MovieBaseRecord | undefined>
  getArtworkTypes: () => Promise<TVDBv4ArtworkTypeRecord[] | undefined>
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

function pickBackgroundArtworkImage(
  artworks: TVDBv4Artwork[],
  artworkTypes: TVDBv4ArtworkTypeRecord[] | undefined,
  recordType: "series" | "movie",
): string | undefined {
  if (!artworks.length) return undefined

  const backgroundTypeIds = (artworkTypes ?? [])
    .filter((type) => type.recordType === recordType && type.name.toLowerCase().includes("background"))
    .map((type) => type.id)
  if (!backgroundTypeIds.length) return undefined

  const candidates = artworks
    .filter((art) => backgroundTypeIds.includes(art.type))
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
  return candidates[0]?.image
}

function fileExtensionFromUrl(url: string): string {
  const matched = url.match(/\.([a-zA-Z0-9]{2,5})(?:[?#].*)?$/)
  return matched?.[1]?.toLowerCase() || "jpg"
}

export async function resolveFanartUrl(
  variables: ScrapeFanartMutationVariables,
  deps: ResolveFanartDeps,
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
      return getTMDBImageUrl(series.backdrop_path, "original") ?? undefined
    }

    if (tvShow.database === "TVDB") {
      const series = await deps.getSeriesExtended(id)
      if (!series) return undefined
      const types = await deps.getArtworkTypes()
      return (
        pickBackgroundArtworkImage(series.artworks ?? [], types, "series") ||
        pickBestArtworkImage(series.artworks ?? [])
      )
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
      return getTMDBImageUrl(details.backdrop_path, "original") ?? undefined
    }

    if (movie.database === "TVDB") {
      const record = await deps.getMovieExtended(id)
      if (!record) return undefined
      const artworks = parseTvdbArtworks((record as Record<string, unknown>).artworks)
      if (!artworks.length) return undefined
      const types = await deps.getArtworkTypes()
      return pickBackgroundArtworkImage(artworks, types, "movie") || pickBestArtworkImage(artworks)
    }
  }

  return undefined
}

export function useScrapeFanartMutation<TContext = unknown>(
  options?: Omit<
    UseMutationOptions<void, Error, ScrapeFanartMutationVariables, TContext>,
    "mutationFn"
  >
) {
  const { getTvShowById, getMovieById } = useTmdbQueries()
  const { getSeriesExtended, getMovieExtended, getArtworkTypes } = useTvdbQueries()

  return useMutation({
    ...options,
    mutationFn: async (variables: ScrapeFanartMutationVariables) => {
      const { mediaMetadata } = variables
      if (!mediaMetadata.mediaFolderPath) return
      const fanartUrl = await resolveFanartUrl(variables, {
        getTvShowById,
        getMovieById,
        getSeriesExtended,
        getMovieExtended,
        getArtworkTypes,
      })
      if (!fanartUrl) return

      const ext = fileExtensionFromUrl(fanartUrl)
      const fanartPath = join(mediaMetadata.mediaFolderPath, `fanart.${ext}`)
      const exists = await checkFileExists(fanartPath)
      if (exists) return

      const response = await downloadImageApi(fanartUrl, fanartPath)
      if (response.error) {
        throw new Error(response.error)
      }
    },
  })
}

