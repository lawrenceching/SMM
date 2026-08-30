import type { TMDBMovie, TMDBTVShow, TmdbSearchResponseBody } from '@smm/core'

export type TmdbSearchMediaType = 'tv' | 'movie'

/**
 * Format TMDB search results for CLI stdout:
 * `#{index} {tmdbid} {title} ({release date})` then overview on the next line.
 */
export function formatTmdbSearchResults(
  body: TmdbSearchResponseBody,
  type: TmdbSearchMediaType,
): string {
  const lines: string[] = []
  for (let i = 0; i < body.results.length; i++) {
    const item = body.results[i]!
    const index = i + 1
    if (type === 'tv') {
      const show = item as TMDBTVShow
      lines.push(`#${index} ${show.id} ${show.name} (${show.first_air_date ?? ''})`)
      lines.push(show.overview ?? '')
    } else {
      const movie = item as TMDBMovie
      lines.push(`#${index} ${movie.id} ${movie.title} (${movie.release_date ?? ''})`)
      lines.push(movie.overview ?? '')
    }
  }
  return lines.join('\n')
}
