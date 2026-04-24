import type {
  TmdbSearchResponseBody,
  TmdbMovieDetails,
  TmdbSeriesDetails,
  TmdbSeasonDetailsRequestBody,
  TmdbSeasonDetails,
} from '@core/types';

export type { TmdbSeasonDetailsRequestBody, TmdbTvSeasonDetails, TmdbSeriesDetails, TmdbSeasonDetails, TmdbMovieDetails } from '@core/types';

export interface TmdbRequestOptions {
  tmdbHost?: string;
  tmdbApiKey?: string;
  signal?: AbortSignal;
}

interface TmdbResolvedConnection {
  directHost?: string;
  tmdbApiKey?: string;
  signal?: AbortSignal;
}

function normalizeHost(host?: string): string | undefined {
  const trimmed = host?.trim();
  if (!trimmed) {
    return undefined;
  }
  return trimmed.replace(/\/+$/, '');
}

function resolveConnection(options?: TmdbRequestOptions, legacyBaseURL?: string): TmdbResolvedConnection {
  const directHost = normalizeHost(options?.tmdbHost ?? legacyBaseURL);
  return {
    directHost,
    tmdbApiKey: options?.tmdbApiKey,
    signal: options?.signal,
  };
}

function assertDirectModeApiKey(apiKey?: string): string {
  const normalized = apiKey?.trim();
  if (!normalized) {
    throw new Error('TMDB API key is required when TMDB host is configured');
  }
  return normalized;
}

async function fetchJson<T>(url: string, init: RequestInit, errorPrefix: string): Promise<T> {
  const resp = await fetch(url, init);
  if (!resp.ok) {
    throw new Error(`${errorPrefix}: ${resp.status} ${resp.statusText}`);
  }
  return resp.json() as Promise<T>;
}

/**
 * Search TMDB for movies or TV shows
 */
export async function searchTmdb(
  keyword: string,
  type: 'movie' | 'tv',
  language: 'zh-CN' | 'en-US' | 'ja-JP',
  optionsOrBaseURL?: TmdbRequestOptions | string
): Promise<TmdbSearchResponseBody> {
  const options = typeof optionsOrBaseURL === 'string' ? undefined : optionsOrBaseURL;
  const legacyBaseURL = typeof optionsOrBaseURL === 'string' ? optionsOrBaseURL : undefined;
  const connection = resolveConnection(options, legacyBaseURL);
  const queryParams = new URLSearchParams();
  queryParams.append('query', keyword);
  queryParams.append('language', language);

  if (connection.directHost) {
    const apiKey = assertDirectModeApiKey(connection.tmdbApiKey);
    const url = `${connection.directHost}/search/${type}?${queryParams.toString()}`;
    return fetchJson<TmdbSearchResponseBody>(
      url,
      {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        signal: connection.signal,
      },
      'Failed to search TMDB'
    );
  }

  if (legacyBaseURL) {
    queryParams.append('baseURL', legacyBaseURL);
  }
  const url = `/tmdb/search/${type}?${queryParams.toString()}`;
  return fetchJson<TmdbSearchResponseBody>(
    url,
    {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      signal: connection.signal,
    },
    'Failed to search TMDB'
  );
}

/**
 * Get TV show by TMDB ID
 */
export async function getTvShowById(
  id: number,
  language?: 'zh-CN' | 'en-US' | 'ja-JP',
  signalOrOptions?: AbortSignal | TmdbRequestOptions
): Promise<TmdbSeriesDetails> {
  const options = signalOrOptions instanceof AbortSignal ? { signal: signalOrOptions } : signalOrOptions;
  const connection = resolveConnection(options);
  const queryParams = new URLSearchParams();
  if (language) {
    queryParams.append('language', language);
  }
  if (!connection.directHost && options?.tmdbHost) {
    queryParams.append('baseURL', options.tmdbHost);
  }
  const queryString = queryParams.toString();
  const url = connection.directHost
    ? `${connection.directHost}/tv/${id}${queryString ? `?${queryString}` : ''}`
    : `/tmdb/tv/${id}${queryString ? `?${queryString}` : ''}`;

  if (connection.directHost) {
    const apiKey = assertDirectModeApiKey(connection.tmdbApiKey);
    return fetchJson<TmdbSeriesDetails>(
      url,
      {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        signal: connection.signal,
      },
      'Failed to get TV show'
    );
  }

  return fetchJson<TmdbSeriesDetails>(
    url,
    {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      signal: connection.signal,
    },
    'Failed to get TV show'
  );
}

/**
 * Get movie by TMDB ID
 */
export async function getMovieById(
  id: number,
  language?: 'zh-CN' | 'en-US' | 'ja-JP',
  signalOrOptions?: AbortSignal | TmdbRequestOptions
): Promise<TmdbMovieDetails> {
  const options = signalOrOptions instanceof AbortSignal ? { signal: signalOrOptions } : signalOrOptions;
  const connection = resolveConnection(options);
  const queryParams = new URLSearchParams();
  if (language) {
    queryParams.append('language', language);
  }
  if (!connection.directHost && options?.tmdbHost) {
    queryParams.append('baseURL', options.tmdbHost);
  }
  const queryString = queryParams.toString();
  const url = connection.directHost
    ? `${connection.directHost}/movie/${id}${queryString ? `?${queryString}` : ''}`
    : `/tmdb/movie/${id}${queryString ? `?${queryString}` : ''}`;

  if (connection.directHost) {
    const apiKey = assertDirectModeApiKey(connection.tmdbApiKey);
    return fetchJson<TmdbMovieDetails>(
      url,
      {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        signal: connection.signal,
      },
      'Failed to get movie'
    );
  }

  return fetchJson<TmdbMovieDetails>(
    url,
    {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      signal: connection.signal,
    },
    'Failed to get movie'
  );
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
    tmdbHost?: string;
    tmdbApiKey?: string;
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
  const connection = resolveConnection(
    {
      tmdbHost: options?.tmdbHost,
      tmdbApiKey: options?.tmdbApiKey,
      signal: options?.signal,
    },
    options?.baseURL
  );
  if (!connection.directHost && req.baseURL) {
    queryParams.append('baseURL', req.baseURL);
  }
  if (req.appendToResponse) {
    queryParams.append('appendToResponse', req.appendToResponse);
  }
  const queryString = queryParams.toString();
  const url = connection.directHost
    ? `${connection.directHost}/tv/${req.seriesId}/season/${req.seasonNumber}${queryString ? `?${queryString}` : ''}`
    : `/tmdb/tv/${req.seriesId}/season/${req.seasonNumber}${queryString ? `?${queryString}` : ''}`;

  if (connection.directHost) {
    const apiKey = assertDirectModeApiKey(connection.tmdbApiKey);
    return fetchJson<TmdbSeasonDetails>(
      url,
      {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        signal: connection.signal,
      },
      'Failed to get TV season'
    );
  }

  return fetchJson<TmdbSeasonDetails>(
    url,
    {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      signal: connection.signal,
    },
    'Failed to get TV season'
  );
}