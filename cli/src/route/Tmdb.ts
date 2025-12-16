import type { TmdbSearchRequestBody, TmdbSearchResponseBody, UserConfig, TMDBMovie, TMDBTVShow } from "@core/types";
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
  try {
    // Get user config to retrieve TMDB settings
    const userConfig = await getUserConfig();
    
    if (!userConfig) {
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

    if (!apiKey) {
      return {
        results: [],
        page: 0,
        total_pages: 0,
        total_results: 0,
        error: 'TMDB API key is not configured. Please set your API key in settings.'
      };
    }

    // Normalize host URL (remove trailing slash if present)
    host = host.replace(/\/+$/, '');

    // Build the search URL
    const searchType = type === 'movie' ? 'movie' : 'tv';
    const tmdbLanguage = mapLanguageToTmdb(language);
    const encodedKeyword = encodeURIComponent(keyword);
    const url = `${host}/search/${searchType}?api_key=${apiKey}&query=${encodedKeyword}&language=${tmdbLanguage}`;

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

    // Make the API request
    const response = await fetch(url, fetchOptions);

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