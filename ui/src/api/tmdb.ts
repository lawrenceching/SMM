import type { TmdbSearchRequestBody, TmdbSearchResponseBody, TmdbTvShowResponseBody } from '@core/types';

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
  language?: 'zh-CN' | 'en-US' | 'ja-JP'
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
  });

  if (!resp.ok) {
    throw new Error(`Failed to get TV show: ${resp.statusText}`);
  }

  const data: TmdbTvShowResponseBody = await resp.json();
  return data;
}

/**
 * Helper function to get TMDB image URL
 */
export function getTMDBImageUrl(
  path: string | null,
  size: 'w200' | 'w300' | 'w500' | 'w780' | 'original' = 'w500'
): string | null {
  if (!path) return null;
  const baseUrl = 'https://image.tmdb.org/t/p';
  return `${baseUrl}/${size}${path}`;
}
