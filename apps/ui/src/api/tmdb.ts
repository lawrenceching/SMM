import type {
  TmdbSearchRequestBody,
  TmdbSearchResponseBody,
  TmdbMovieDetails,
  TmdbSeriesDetails,
  TmdbSeasonDetailsRequestBody,
  TmdbSeasonDetails,
} from '@core/types';

export type { TmdbSeasonDetailsRequestBody, TmdbTvSeasonDetails, TmdbSeriesDetails, TmdbSeasonDetails, TmdbMovieDetails } from '@core/types';

/**
 * Search TMDB for movies or TV shows
 */
export async function searchTmdb(
  keyword: string,
  type: 'movie' | 'tv',
  language: 'zh-CN' | 'en-US' | 'ja-JP',
  baseURL?: string
): Promise<TmdbSearchResponseBody> {
  const queryParams = new URLSearchParams();
  queryParams.append('query', keyword);
  queryParams.append('language', language);
  if (baseURL) {
    queryParams.append('baseURL', baseURL);
  }

  const url = `/tmdb/search/${type}?${queryParams.toString()}`;

  const resp = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!resp.ok) {
    throw new Error(`Failed to search TMDB: ${resp.statusText}`);
  }

  const data: TmdbSearchResponseBody = await resp.json();
  return data;
}

/**
 * Get TV show by TMDB ID
 */
export async function getTvShowById(
  id: number,
  language?: 'zh-CN' | 'en-US' | 'ja-JP',
  signal?: AbortSignal
): Promise<TmdbSeriesDetails> {
  const queryParams = new URLSearchParams();
  if (language) {
    queryParams.append('language', language);
  }
  const queryString = queryParams.toString();
  const url = `/tmdb/tv/${id}${queryString ? `?${queryString}` : ''}`;

  const resp = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
    signal,
  });

  if (!resp.ok) {
    throw new Error(`Failed to get TV show: ${resp.statusText}`);
  }

  const data: TmdbSeriesDetails = await resp.json();
  return data;
}

/**
 * Get movie by TMDB ID
 */
export async function getMovieById(
  id: number,
  language?: 'zh-CN' | 'en-US' | 'ja-JP',
  signal?: AbortSignal
): Promise<TmdbMovieDetails> {
  const queryParams = new URLSearchParams();
  if (language) {
    queryParams.append('language', language);
  }
  const queryString = queryParams.toString();
  const url = `/tmdb/movie/${id}${queryString ? `?${queryString}` : ''}`;

  const resp = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
    signal,
  });

  if (!resp.ok) {
    throw new Error(`Failed to get movie: ${resp.statusText}`);
  }

  const data: TmdbMovieDetails = await resp.json();
  return data;
}

/**
 * Helper function to get TMDB image URL
 * Handles both relative paths (e.g., /abc123.jpg) and absolute URLs (e.g., https://example.com/image.jpg)
 */
export function getTMDBImageUrl(
  path: string | null | undefined = undefined,
  size: 'w200' | 'w300' | 'w500' | 'w780' | 'original' = 'w500'
): string | null {
  if (!path || typeof path !== 'string') return null;

  const trimmedPath = path.trim();
  if (trimmedPath.length === 0) return null;

  if (trimmedPath.startsWith('http://') || trimmedPath.startsWith('https://')) {
    return trimmedPath;
  }

  const baseUrl = 'https://image.tmdb.org/t/p';
  return `${baseUrl}/${size}${trimmedPath}`;
}

/**
 * Get TV season details by series id and season number (TMDB GET /3/tv/{series_id}/season/{season_number}).
 * @see https://developer.themoviedb.org/reference/tv-season-details
 */
export async function getSeason(
  seriesId: number,
  seasonNumber: number,
  language?: 'zh-CN' | 'en-US' | 'ja-JP',
  options?: {
    baseURL?: string;
    appendToResponse?: string;
    signal?: AbortSignal;
  }
): Promise<TmdbSeasonDetails> {
  const req: TmdbSeasonDetailsRequestBody = {
    seriesId,
    seasonNumber,
    language,
    baseURL: options?.baseURL,
    appendToResponse: options?.appendToResponse,
  };

  const queryParams = new URLSearchParams();
  if (req.language) {
    queryParams.append('language', req.language);
  }
  if (req.baseURL) {
    queryParams.append('baseURL', req.baseURL);
  }
  if (req.appendToResponse) {
    queryParams.append('appendToResponse', req.appendToResponse);
  }
  const queryString = queryParams.toString();
  const url = `/tmdb/tv/${req.seriesId}/season/${req.seasonNumber}${queryString ? `?${queryString}` : ''}`;

  const resp = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
    signal: options?.signal,
  });

  if (!resp.ok) {
    throw new Error(`Failed to get TV season: ${resp.statusText}`);
  }

  const data: TmdbSeasonDetails = await resp.json();
  return data;
}