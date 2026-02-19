import type { TmdbSearchRequestBody, TmdbSearchResponseBody, TmdbMovieResponseBody, TmdbTvShowResponseBody, UserConfig, TMDBMovie, TMDBTVShow, TMDBTVShowDetails, TMDBSeason } from "@core/types";
import { getUserDataDir } from '@/utils/config';
import path from "path";
import type { Hono } from 'hono';
import { logger } from '../../lib/logger';

/**
 * Reads user config from smm.json file
 */
async function getUserConfig(): Promise<UserConfig | null> {
  try {
    const userDataDir = getUserDataDir();
    const configPath = path.join(userDataDir, 'smm.json');
    const file = Bun.file(configPath);
    
    if (!(await file.exists())) {
      return null;
    }
    
    const content = await file.text();
    return JSON.parse(content) as UserConfig;
  } catch (error) {
    console.error('Failed to read user config:', error);
    return null;
  }
}

/**
 * Maps language code to TMDB language code
 */
function mapLanguageToTmdb(language: 'zh-CN' | 'en-US' | 'ja-JP'): string {
  const languageMap: Record<'zh-CN' | 'en-US' | 'ja-JP', string> = {
    'zh-CN': 'zh-CN',
    'en-US': 'en-US',
    'ja-JP': 'ja-JP'
  };
  return languageMap[language] || 'en-US';
}

/**
 * Helper function to get TMDB configuration with validation
 * @param baseURL - Optional base URL override
 * @returns Configuration object or error string
 */
async function getTmdbConfig(baseURL?: string): Promise<{
  host: string;
  apiKey?: string;
  httpProxy?: string;
  isOfficialHost: boolean;
  error?: string;
}> {
  // Get user config to retrieve TMDB settings
  const userConfig = await getUserConfig();
  
  if (!userConfig) {
    console.error('User config not found. Please configure TMDB settings.');
    return {
      host: '',
      isOfficialHost: false,
      error: 'User config not found. Please configure TMDB settings.'
    };
  }

  // Get TMDB configuration
  const tmdbConfig = userConfig.tmdb;
  const apiKey = tmdbConfig?.apiKey;
  let host = baseURL || tmdbConfig?.host || 'https://tmdb-mcp-server.imlc.me';
  const httpProxy = tmdbConfig?.httpProxy;

  // Normalize host URL (remove trailing slash if present)
  host = host.replace(/\/+$/, '');

  // Check if this is the official TMDB host
  const officialTmdbHost = 'https://api.themoviedb.org/3';
  const isOfficialHost = host === officialTmdbHost;

  // Only require API key for official TMDB host
  if (isOfficialHost && !apiKey) {
    return {
      host: '',
      isOfficialHost: false,
      error: 'TMDB API key is not configured. Please set your API key in settings.'
    };
  }

  return {
    host,
    apiKey,
    httpProxy,
    isOfficialHost
  };
}

/**
 * Helper function to execute TMDB HTTP requests with shared error handling
 * @param url - Full URL to request (must be built by caller)
 * @param apiKey - TMDB API key for Bearer token authentication
 * @param host - TMDB host URL to determine if using official API
 * @param httpProxy - Optional HTTP proxy setting (for logging)
 * @returns Promise with Response object or error string
 */
async function executeTmdbRequest(
  url: string,
  apiKey?: string,
  host?: string,
  httpProxy?: string
): Promise<{ response: Response; error?: string }> {
  try {
    // Prepare fetch options
    const headers = new Headers({
      'Accept': 'application/json',
    });

    // Add Bearer token authorization for official TMDB host
    if (host === 'https://api.themoviedb.org' && apiKey) {
      headers.set('Authorization', `Bearer ${apiKey}`);
      console.log('[TMDB] Using Bearer token authentication');
    }

    const fetchOptions: RequestInit = {
      method: 'GET',
      headers,
    };

    // Configure proxy if provided
    if (httpProxy) {
      // Bun supports proxy via environment variables or fetch options
      // For Bun, we can use the proxy in the URL or set it via environment
      // Since Bun's fetch may not directly support proxy in options,
      // we'll note that proxy configuration might need to be handled at the system level
      // or via a proxy agent if available
      console.log(`Using proxy: ${httpProxy}`);
    }

    console.log(`[HTTP_OUT] ${fetchOptions.method} ${url}`);
    // Make the API request
    const response = await fetch(url, fetchOptions);
    console.log(`[HTTP_IN] ${fetchOptions.method} ${url} ${response.status} ${response.statusText}`);

    return { response };
  } catch (error) {
    console.error('TMDB request error:', error);
    return {
      response: new Response(null, { status: 500 }),
      error: `Failed to fetch from TMDB: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}

/**
 * Searches TMDB for movies or TV shows
 */
export async function search({ keyword, type, baseURL, language }: TmdbSearchRequestBody): Promise<TmdbSearchResponseBody> {
  console.log(`[Tmdb.search] keyword: ${keyword}, type: ${type}, baseURL: ${baseURL}, language: ${language}`);
  try {
    // Get TMDB configuration
    const config = await getTmdbConfig(baseURL);
    
    if (config.error) {
      return {
        results: [],
        page: 0,
        total_pages: 0,
        total_results: 0,
        error: config.error
      };
    }

    console.log(`[Tmdb.search] apiKey: ${config.apiKey}, host: ${config.host}, httpProxy: ${config.httpProxy}`);

    // Build the search URL (no api_key in query param - using Bearer token for official host)
    const searchType = type === 'movie' ? 'movie' : 'tv';
    const tmdbLanguage = mapLanguageToTmdb(language);
    const encodedKeyword = encodeURIComponent(keyword);
    const url = `${config.host}/3/search/${searchType}?query=${encodedKeyword}&language=${tmdbLanguage}`;

    // Execute the HTTP request
    const requestResult = await executeTmdbRequest(url, config.apiKey, config.host, config.httpProxy);
    
    if (requestResult.error) {
      return {
        results: [],
        page: 0,
        total_pages: 0,
        total_results: 0,
        error: requestResult.error
      };
    }

    const response = requestResult.response;

    if (!response.ok) {
      const errorText = await response.text();
      return {
        results: [],
        page: 0,
        total_pages: 0,
        total_results: 0,
        error: `TMDB API error: ${response.status} ${response.statusText}. ${errorText}`
      };
    }

    const data = await response.json() as {
      results: Array<TMDBMovie | TMDBTVShow>;
      page: number;
      total_pages: number;
      total_results: number;
    };

    return {
      results: data.results || [],
      page: data.page || 0,
      total_pages: data.total_pages || 0,
      total_results: data.total_results || 0
    };
  } catch (error) {
    console.error('TMDB search error:', error);
    return {
      results: [],
      page: 0,
      total_pages: 0,
      total_results: 0,
      error: `Failed to search TMDB: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}

/**
 * Helper function to build TMDB API URL and make request
 */
async function makeTmdbRequest(
  endpoint: string,
  language?: 'zh-CN' | 'en-US' | 'ja-JP',
  baseURL?: string,
  appendToResponse?: string
): Promise<{ data: any; error?: string }> {
  try {
    // Get TMDB configuration
    const config = await getTmdbConfig(baseURL);
    
    if (config.error) {
      return {
        data: null,
        error: config.error
      };
    }

    console.log(`[Tmdb.request] apiKey: ${config.apiKey}, host: ${config.host}, httpProxy: ${config.httpProxy}, endpoint: ${endpoint}`);

    // Build the URL
    const tmdbLanguage = language ? mapLanguageToTmdb(language) : 'en-US';
    const queryParams: string[] = [];

    // Add language parameter
    if (language) {
      queryParams.push(`language=${tmdbLanguage}`);
    }
    if (appendToResponse) {
      queryParams.push(`append_to_response=${encodeURIComponent(appendToResponse)}`);
    }

    const queryString = queryParams.length > 0 ? `?${queryParams.join('&')}` : '';
    const url = `${config.host}${endpoint}${queryString}`;

    // Execute the HTTP request
    const requestResult = await executeTmdbRequest(url, config.apiKey, config.host, config.httpProxy);
    
    if (requestResult.error) {
      return {
        data: null,
        error: requestResult.error
      };
    }

    const response = requestResult.response;

    if (!response.ok) {
      const errorText = await response.text();
      return {
        data: null,
        error: `TMDB API error: ${response.status} ${response.statusText}. ${errorText}`
      };
    }

    const data = await response.json();
    return { data };
  } catch (error) {
    console.error('TMDB request error:', error);
    return {
      data: null,
      error: `Failed to fetch from TMDB: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}

/**
 * Gets a movie by TMDB ID
 */
export async function getMovie(
  id: number,
  language?: 'zh-CN' | 'en-US' | 'ja-JP',
  baseURL?: string
): Promise<TmdbMovieResponseBody> {
  console.log(`[Tmdb.getMovie] id: ${id}, language: ${language}, baseURL: ${baseURL}`);
  
  if (!id || id <= 0) {
    return {
      data: undefined,
      error: 'Invalid movie ID'
    };
  }

  const result = await makeTmdbRequest(`/movie/${id}`, language, baseURL);
  
  if (result.error) {
    return {
      data: undefined,
      error: result.error
    };
  }

  return {
    data: result.data as TMDBMovie
  };
}

/**
 * Gets a TV show by TMDB ID with all seasons and episodes using append_to_response
 */
export async function getTvShow(
  id: number,
  language?: 'zh-CN' | 'en-US' | 'ja-JP',
  baseURL?: string
): Promise<TmdbTvShowResponseBody> {
  console.log(`[Tmdb.getTvShow] id: ${id}, language: ${language}, baseURL: ${baseURL}`);
  
  if (!id || id <= 0) {
    return {
      data: undefined,
      error: 'Invalid TV show ID'
    };
  }

  // First, get basic TV show info to determine which seasons exist
  const basicResult = await makeTmdbRequest(`/tv/${id}`, language, baseURL);
  
  if (basicResult.error) {
    return {
      data: undefined,
      error: basicResult.error
    };
  }

  const basicData = basicResult.data as TMDBTVShowDetails;
  
  // Build append_to_response parameter with all existing seasons
  // Use the seasons array from the basic response to get accurate season numbers
  const seasonNumbers: string[] = [];
  if (basicData.seasons && Array.isArray(basicData.seasons)) {
    basicData.seasons.forEach(season => {
      seasonNumbers.push(`season/${season.season_number}`);
    });
  }
  
  // If no seasons array or empty, fall back to number_of_seasons
  if (seasonNumbers.length === 0 && basicData.number_of_seasons) {
    for (let i = 0; i <= basicData.number_of_seasons; i++) {
      seasonNumbers.push(`season/${i}`);
    }
  }
  
  // If no seasons to append, return the basic data
  if (seasonNumbers.length === 0) {
    return {
      data: basicData
    };
  }
  
  const appendToResponse = seasonNumbers.join(',');
  
  // Now make a request with append_to_response to get all seasons with episodes
  const result = await makeTmdbRequest(`/tv/${id}`, language, baseURL, appendToResponse);
  
  if (result.error) {
    return {
      data: undefined,
      error: result.error
    };
  }

  const fullData = result.data as TMDBTVShowDetails & Record<string, any>;
  
  // Merge the appended season data back into the seasons array
  if (fullData.seasons && Array.isArray(fullData.seasons)) {
    fullData.seasons = fullData.seasons.map((season) => {
      const seasonKey = `season/${season.season_number}`;
      // If this season was appended, use the appended data which includes episodes
      if (fullData[seasonKey] && fullData[seasonKey].episodes) {
        return {
          ...season,
          episodes: fullData[seasonKey].episodes
        };
      }
      return season;
    });
  }

  // Clean up the appended season objects from the response
  seasonNumbers.forEach(seasonKey => {
    delete fullData[seasonKey];
  });

  return {
    data: fullData as TMDBTVShowDetails
  };
}

export function handleTmdb(app: Hono) {
  // POST /api/tmdb/search - Search TMDB for movies or TV shows
  app.post('/api/tmdb/search', async (c) => {
    try {
      const rawBody = await c.req.json();
      const result = await search(rawBody);
      
      // If there's an error, return 200 with error field (following the pattern)
      return c.json(result, 200);
    } catch (error) {
      logger.error({ error }, 'TMDB search route error:');
      return c.json({ 
        results: [],
        page: 0,
        total_pages: 0,
        total_results: 0,
        error: `Failed to process TMDB search request: ${error instanceof Error ? error.message : 'Unknown error'}`
      }, 200);
    }
  });

  // GET /api/tmdb/movie/:id - Get movie by TMDB ID
  app.get('/api/tmdb/movie/:id', async (c) => {
    try {
      const id = parseInt(c.req.param('id'));
      const language = c.req.query('language') as 'zh-CN' | 'en-US' | 'ja-JP' | undefined;
      const baseURL = c.req.query('baseURL');
      
      if (isNaN(id)) {
        return c.json({
          data: undefined,
          error: 'Invalid movie ID'
        }, 200);
      }

      const result = await getMovie(id, language, baseURL);
      return c.json(result, 200);
    } catch (error) {
      logger.error({ error }, 'TMDB get movie route error:');
      return c.json({
        data: undefined,
        error: `Failed to get movie: ${error instanceof Error ? error.message : 'Unknown error'}`
      }, 200);
    }
  });

  // GET /api/tmdb/tv/:id - Get TV show by TMDB ID
  app.get('/api/tmdb/tv/:id', async (c) => {
    try {
      const id = parseInt(c.req.param('id'));
      const language = c.req.query('language') as 'zh-CN' | 'en-US' | 'ja-JP' | undefined;
      const baseURL = c.req.query('baseURL');
      
      if (isNaN(id)) {
        return c.json({
          data: undefined,
          error: 'Invalid TV show ID'
        }, 200);
      }

      const result = await getTvShow(id, language, baseURL);
      return c.json(result, 200);
    } catch (error) {
      logger.error({ error }, 'TMDB get TV show route error:');
      return c.json({
        data: undefined,
        error: `Failed to get TV show: ${error instanceof Error ? error.message : 'Unknown error'}`
      }, 200);
    }
  });
}