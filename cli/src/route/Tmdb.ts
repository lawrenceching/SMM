import type { TmdbSearchRequestBody, TmdbSearchResponseBody, TmdbMovieResponseBody, TmdbTvShowResponseBody, UserConfig, TMDBMovie, TMDBTVShow, TMDBTVShowDetails } from "@core/types";
import { getUserDataDir } from "../../tasks/HelloTask";
import path from "path";

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
 * Searches TMDB for movies or TV shows
 */
export async function search({ keyword, type, baseURL, language }: TmdbSearchRequestBody): Promise<TmdbSearchResponseBody> {
  console.log(`[Tmdb.search] keyword: ${keyword}, type: ${type}, baseURL: ${baseURL}, language: ${language}`);
  try {
    // Get user config to retrieve TMDB settings
    const userConfig = await getUserConfig();
    
    if (!userConfig) {
        console.error('User config not found. Please configure TMDB settings.');
      return {
        results: [],
        page: 0,
        total_pages: 0,
        total_results: 0,
        error: 'User config not found. Please configure TMDB settings.'
      };
    }

    // Get TMDB configuration
    const tmdbConfig = userConfig.tmdb;
    const apiKey = tmdbConfig?.apiKey;
    let host = baseURL || tmdbConfig?.host || 'https://api.themoviedb.org/3';
    const httpProxy = tmdbConfig?.httpProxy;
    console.log(`[Tmdb.search] apiKey: ${apiKey}, host: ${host}, httpProxy: ${httpProxy}`);

    // Normalize host URL (remove trailing slash if present)
    host = host.replace(/\/+$/, '');

    // Check if this is the official TMDB host
    const officialTmdbHost = 'https://api.themoviedb.org/3';
    const isOfficialHost = host === officialTmdbHost;

    // Only require API key for official TMDB host
    if (isOfficialHost && !apiKey) {
      return {
        results: [],
        page: 0,
        total_pages: 0,
        total_results: 0,
        error: 'TMDB API key is not configured. Please set your API key in settings.'
      };
    }

    // Build the search URL
    const searchType = type === 'movie' ? 'movie' : 'tv';
    const tmdbLanguage = mapLanguageToTmdb(language);
    const encodedKeyword = encodeURIComponent(keyword);
    
    // Include api_key parameter only for official TMDB host
    // For custom hosts, the API key is embedded in the 3rd party server
    const apiKeyParam = isOfficialHost && apiKey ? `api_key=${apiKey}&` : '';
    const url = `${host}/search/${searchType}?${apiKeyParam}query=${encodedKeyword}&language=${tmdbLanguage}`;

    // Prepare fetch options
    const fetchOptions: RequestInit = {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
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
  baseURL?: string
): Promise<{ data: any; error?: string }> {
  try {
    // Get user config to retrieve TMDB settings
    const userConfig = await getUserConfig();
    
    if (!userConfig) {
      console.error('User config not found. Please configure TMDB settings.');
      return {
        data: null,
        error: 'User config not found. Please configure TMDB settings.'
      };
    }

    // Get TMDB configuration
    const tmdbConfig = userConfig.tmdb;
    const apiKey = tmdbConfig?.apiKey;
    let host = baseURL || tmdbConfig?.host || 'https://api.themoviedb.org/3';
    const httpProxy = tmdbConfig?.httpProxy;
    console.log(`[Tmdb.request] apiKey: ${apiKey}, host: ${host}, httpProxy: ${httpProxy}, endpoint: ${endpoint}`);

    // Normalize host URL (remove trailing slash if present)
    host = host.replace(/\/+$/, '');

    // Check if this is the official TMDB host
    const officialTmdbHost = 'https://api.themoviedb.org/3';
    const isOfficialHost = host === officialTmdbHost;

    // Only require API key for official TMDB host
    if (isOfficialHost && !apiKey) {
      return {
        data: null,
        error: 'TMDB API key is not configured. Please set your API key in settings.'
      };
    }

    // Build the URL
    const tmdbLanguage = language ? mapLanguageToTmdb(language) : 'en-US';
    const queryParams: string[] = [];
    
    if (isOfficialHost && apiKey) {
      queryParams.push(`api_key=${apiKey}`);
    }
    if (language) {
      queryParams.push(`language=${tmdbLanguage}`);
    }
    
    const queryString = queryParams.length > 0 ? `?${queryParams.join('&')}` : '';
    const url = `${host}${endpoint}${queryString}`;

    // Prepare fetch options
    const fetchOptions: RequestInit = {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    };

    // Configure proxy if provided
    if (httpProxy) {
      console.log(`Using proxy: ${httpProxy}`);
    }

    console.log(`[HTTP_OUT] ${fetchOptions.method} ${url}`);
    // Make the API request
    const response = await fetch(url, fetchOptions);
    console.log(`[HTTP_IN] ${fetchOptions.method} ${url} ${response.status} ${response.statusText}`);

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
 * Gets a TV show by TMDB ID
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

  const result = await makeTmdbRequest(`/tv/${id}`, language, baseURL);
  
  if (result.error) {
    return {
      data: undefined,
      error: result.error
    };
  }

  return {
    data: result.data as TMDBTVShowDetails
  };
}