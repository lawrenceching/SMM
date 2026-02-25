import type { TmdbSearchRequestBody, TmdbSearchResponseBody, TmdbMovieResponseBody, TmdbTvShowResponseBody } from '@core/types';

/**
 * Search TMDB for movies or TV shows
 */
export async function searchTmdb(
  keyword: string,
  type: 'movie' | 'tv',
  language: 'zh-CN' | 'en-US' | 'ja-JP',
  baseURL?: string
): Promise<TmdbSearchResponseBody> {
  const req: TmdbSearchRequestBody = {
    keyword,
    type,
    language,
    baseURL,
  };

  const resp = await fetch('/api/tmdb/search', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(req),
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
): Promise<TmdbTvShowResponseBody> {
  const queryParams = new URLSearchParams();
  if (language) {
    queryParams.append('language', language);
  }
  const queryString = queryParams.toString();
  const url = `/api/tmdb/tv/${id}${queryString ? `?${queryString}` : ''}`;

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

  const data: TmdbTvShowResponseBody = await resp.json();
  return data;
}

/**
 * Get movie by TMDB ID
 */
export async function getMovieById(
  id: number,
  language?: 'zh-CN' | 'en-US' | 'ja-JP',
  signal?: AbortSignal
): Promise<TmdbMovieResponseBody> {
  const queryParams = new URLSearchParams();
  if (language) {
    queryParams.append('language', language);
  }
  const queryString = queryParams.toString();
  const url = `/api/tmdb/movie/${id}${queryString ? `?${queryString}` : ''}`;

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

  const data: TmdbMovieResponseBody = await resp.json();
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
