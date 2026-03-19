/**
 * TVDB (TheTVDB) API client. Results are normalized to a TMDB-like shape for display in shared search UI.
 */

export interface TvdbSearchResponseBody {
  results: Array<{
    id: number
    name?: string
    title?: string
    overview?: string
    poster_path?: string | null
    first_air_date?: string
    release_date?: string
    vote_average?: number
    media_type?: 'tv' | 'movie'
  }>
  page: number
  total_pages: number
  total_results: number
  error?: string
}

export async function searchTvdb(
  keyword: string,
  type: 'movie' | 'tv'
): Promise<TvdbSearchResponseBody> {
  const resp = await fetch('/api/tvdb/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ keyword: keyword.trim(), type }),
  })

  if (!resp.ok) {
    throw new Error(`Failed to search TVDB: ${resp.statusText}`)
  }

  const data: TvdbSearchResponseBody = await resp.json()
  return data
}

export interface TvdbSeriesResponseBody {
  data?: unknown
  error?: string
}

export async function getTvdbSeriesById(
  id: number,
  _signal?: AbortSignal
): Promise<TvdbSeriesResponseBody> {
  const resp = await fetch(`/api/tvdb/series/${id}`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  })

  if (!resp.ok) {
    throw new Error(`Failed to get TVDB series: ${resp.statusText}`)
  }

  return resp.json()
}

export interface TvdbMovieResponseBody {
  data?: unknown
  error?: string
}

export async function getTvdbMovieById(
  id: number,
  _signal?: AbortSignal
): Promise<TvdbMovieResponseBody> {
  const resp = await fetch(`/api/tvdb/movie/${id}`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  })

  if (!resp.ok) {
    throw new Error(`Failed to get TVDB movie: ${resp.statusText}`)
  }

  return resp.json()
}
