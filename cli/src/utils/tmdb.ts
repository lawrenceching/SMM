import path from "path"
import crypto from "crypto"
import fs from "fs/promises"
import type { TMDBTVShowDetails, TMDBSearchType, TMDBSearchResponse, TMDBError, TMDBMovie, TMDBSeason, TMDBResult } from "../core/types"



export interface TMDBOptions {
    baseURL?: string
    apiKey?: string
    httpProxy?: string
}

class TMDB {
    private baseUrl: string
    private apiKey: string
    private httpProxy?: string

    constructor() {
        // Use config file settings with fallback to environment variables
        const configHost = config.tmdb.host
        const configApiKey = config.tmdb.apiKey
        const configProxy = config.tmdb.httpProxy
        
        this.baseUrl = configHost ? `${configHost}/3` : 'https://api.themoviedb.org/3'
        this.apiKey = configApiKey || ''
        this.httpProxy = configProxy
        
        if (!this.apiKey) {
            console.warn('TMDB API key not found. Please set TMDB API key in settings or TMDB_API_KEY environment variable.')
        }
        
        console.log(`TMDB initialized with base URL: ${this.baseUrl}`)
        if (this.httpProxy) {
            console.log(`TMDB using HTTP proxy: ${this.httpProxy}`)
        }
    }

    /**
     * Update TMDB configuration
     * @param host - TMDB host URL
     * @param apiKey - TMDB API key
     * @param proxy - HTTP proxy URL
     */
    updateConfig(host?: string, apiKey?: string, proxy?: string) {
        if (host) {
            this.baseUrl = `${host}/3`
            console.log(`TMDB base URL updated to: ${this.baseUrl}`)
        }
        if (apiKey !== undefined) {
            this.apiKey = apiKey
            console.log('TMDB API key updated')
        }
        if (proxy !== undefined) {
            this.httpProxy = proxy
            if (proxy) {
                console.log(`TMDB HTTP proxy updated to: ${proxy}`)
            } else {
                console.log('TMDB HTTP proxy disabled')
            }
        }
    }

    /**
     * Search for media using TMDB API
     * @param query - Search query string
     * @param type - Type of media to search for (default: 'movie')
     * @param page - Page number (default: 1)
     * @param language - Language code for search results (default: 'en-US')
     * @returns Promise<TMDBSearchResponse>
     */
    async search(query: string, type: TMDBSearchType = 'movie', page: number = 1, language: LanguageCode = 'en-US',
        options?: TMDBOptions
    ): Promise<TMDBSearchResponse> {
        return withSpan('tmdb.search', { 'tmdb.type': type, 'tmdb.language': language }, async () => {
            if (!query || query.trim().length === 0) {
                throw new Error('Search query cannot be empty')
            }

            let apiKeyParam = ''
            if(options !== undefined) {

                if(options.apiKey) {
                    apiKeyParam =  `api_key=${options.apiKey}`
                }

            } 

            const url = `${options?.baseURL || this.baseUrl}/search/${type}?${apiKeyParam}&query=${encodeURIComponent(query)}&page=${page}&language=${language}`
            
            console.log(`🔍 TMDB Search: Searching for "${query}" in ${type} (page ${page}, language: ${language})`)
            console.log(`📡 TMDB API URL: ${url}`)
            appLog(levels.INFO, `Serach in TMDB: ${url.replace(apiKeyParam, 'api_key=********')}}`)

            try {
                const response = await fetch(url)
                
                console.log(`📊 TMDB Response Status: ${response.status} ${response.statusText}`)
                
                if (!response.ok) {
                    const errorData: TMDBError = await response.json()
                    console.error(`❌ TMDB API Error: ${errorData.status_code} - ${errorData.status_message}`)
                    throw new Error(`TMDB API Error: ${errorData.status_message}`)
                }

                const data: TMDBSearchResponse = await response.json()
                
                console.log(`✅ TMDB Search Results: Found ${data.total_results} ${type}s across ${data.total_pages} pages`)
                console.log(`📄 Current page: ${data.page} with ${data.results.length} results`)
                
                // Log first few results for debugging
                if (data.results.length > 0) {
                    console.log(`🎬 Sample ${type} results:`)
                    data.results.slice(0, 3).forEach((result, index) => {
                        const title = this.getResultTitle(result)
                        const date = this.getResultDate(result)
                        const rating = this.getResultRating(result)
                        console.log(`  ${index + 1}. "${title}" (${date})${rating ? ` - Rating: ${rating}/10` : ''}`)
                    })
                }

                console.log(`TMDB Search Results:\n${JSON.stringify(data)}`)
                return data
            } catch (error) {
                console.error('❌ TMDB Search Error:', error)
                appLogError(`TMDB Search (${url})`, error)
                recordError(error as Error, { 'operation': 'tmdb.search', 'tmdb.type': type });
                throw error
            }
        });
    }

    /**
     * Get movie details by ID
     * @param movieId - TMDB movie ID
     * @param language - Language code for movie details (default: 'en-US')
     * @param options - Optional TMDB configuration overrides
     * @returns Promise<TMDBMovie>
     */
    async getMovie(movieId: number, language: LanguageCode = 'en-US', options?: TMDBOptions): Promise<TMDBMovie> {
        return withSpan('tmdb.getMovie', { 'tmdb.movie_id': movieId }, async () => {
            let apiKeyParam = ''
            if(options !== undefined) {
                if(options.apiKey) {
                    apiKeyParam = `api_key=${options.apiKey}`
                }
            } 

        const url = `${options?.baseURL || this.baseUrl}/movie/${movieId}?${apiKeyParam}&language=${language}`
        
        console.log(`🎬 TMDB Get Movie: Fetching movie ID ${movieId} (language: ${language})`)
        console.log(`📡 TMDB API URL: ${url}`)

        try {
            const response = await fetch(url)
            
            console.log(`📊 TMDB Response Status: ${response.status} ${response.statusText}`)
            
            if (!response.ok) {
                const errorData: TMDBError = await response.json()
                console.error(`❌ TMDB API Error: ${errorData.status_code} - ${errorData.status_message}`)
                throw new Error(`TMDB API Error: ${errorData.status_message}`)
            }

            const movie: TMDBMovie = await response.json()
            
            console.log(`✅ TMDB Movie Retrieved: "${movie.title}" (${movie.release_date})`)
            console.log(`📊 Movie Details: Rating ${movie.vote_average}/10, ${movie.vote_count} votes`)

            return movie
        } catch (error) {
            console.error('❌ TMDB Get Movie Error:', error)
            appLogError(`TMDB Get Movie (${url})`, error)
            recordError(error as Error, { 'operation': 'tmdb.getMovie', 'tmdb.movie_id': movieId });
            throw error
        }
        });
    }

    /**
     * Get TV show details by ID
     * @param tvShowId - TMDB TV show ID
     * @param language - Language code for TV show details (default: 'en-US')
     * @param options - Optional TMDB configuration overrides
     * @returns Promise<TMDBTVShowDetails>
     */
    async getTVShow(tvShowId: number, language: LanguageCode = 'en-US', options?: TMDBOptions): Promise<TMDBTVShowDetails> {
        let apiKeyParam = ''
        if(options !== undefined) {
            if(options.apiKey) {
                apiKeyParam = `api_key=${options.apiKey}`
            }
        } 

        const url = `${options?.baseURL || this.baseUrl}/tv/${tvShowId}?${apiKeyParam}&append_to_response=seasons&language=${language}`
        if(cache.has(url)) {
            console.log(`📊 TMDB Cache Hit: ${url}`)
            return cache.get(url)
        }

        const fileCache = await getFileCache(url)
        if(fileCache) {
            console.log(`📊 TMDB File Cache Hit: ${url}`)
            return fileCache as TMDBTVShowDetails
        }
        
        console.log(`📺 TMDB Get TV Show: Fetching TV show ID ${tvShowId} (language: ${language})`)
        console.log(`📡 TMDB API URL: ${url}`)

        try {
            const response = await fetch(url)
            
            console.log(`📊 TMDB Response Status: ${response.status} ${response.statusText}`)
            
            if (!response.ok) {
                const errorData: TMDBError = await response.json()
                console.error(`❌ TMDB API Error: ${errorData.status_code} - ${errorData.status_message}`)
                throw new Error(`TMDB API Error: ${errorData.status_message}`)
            }

            const tvShow: TMDBTVShowDetails = await response.json()
            
            console.log(`✅ TMDB TV Show Retrieved: "${tvShow.name}" (${tvShow.first_air_date})`)
            console.log(`📊 TV Show Details: ${tvShow.number_of_seasons} seasons, ${tvShow.number_of_episodes} episodes`)

            console.log(`TMDB TVShow Results:\n${JSON.stringify(tvShow)}`)
            cache.set(url, tvShow)
            return tvShow
        } catch (error) {
            console.error('❌ TMDB Get TV Show Error:', error)
            appLogError(`TMDB Get TV Show (${url})`, error)
            throw error
        }
    }

    /**
     * Get season details by TV show ID and season number
     * @param tvShowId - TMDB TV show ID
     * @param seasonNumber - Season number
     * @param language - Language code for season details (default: 'en-US')
     * @param options - Optional TMDB configuration overrides
     * @returns Promise<TMDBSeason>
     */
    async getSeason(tvShowId: number, seasonNumber: number, language: LanguageCode = 'en-US', options?: TMDBOptions): Promise<TMDBSeason> {
        let apiKeyParam = ''
        if(options !== undefined) {
            if(options.apiKey) {
                apiKeyParam = `api_key=${options.apiKey}`
            }
        } 

        const url = `${options?.baseURL || this.baseUrl}/tv/${tvShowId}/season/${seasonNumber}?${apiKeyParam}&language=${language}`
        
        console.log(`📺 TMDB Get Season: Fetching season ${seasonNumber} for TV show ID ${tvShowId}`)
        console.log(`📡 TMDB API URL: ${url}`)

        try {
            const response = await fetch(url)
            
            console.log(`📊 TMDB Response Status: ${response.status} ${response.statusText}`)
            
            if (!response.ok) {
                const errorData: TMDBError = await response.json()
                console.error(`❌ TMDB API Error: ${errorData.status_code} - ${errorData.status_message}`)
                throw new Error(`TMDB API Error: ${errorData.status_message}`)
            }

            const season: TMDBSeason = await response.json()
            
            console.log(`✅ TMDB Season Retrieved: "${season.name}" with ${season.episode_count} episodes`)

            return season
        } catch (error) {
            console.error('❌ TMDB Get Season Error:', error)
            appLogError(`TMDB Get Season (${url})`, error)
            throw error
        }
    }

    /**
     * Get poster image URL
     * @param posterPath - Poster path from TMDB response
     * @param size - Image size (default: 'w500')
     * @returns Full poster URL
     */
    getPosterUrl(posterPath: string | null, size: string = 'w500'): string | null {
        if (!posterPath) return null
        return `https://image.tmdb.org/t/p/${size}${posterPath}`
    }

    /**
     * Get backdrop image URL
     * @param backdropPath - Backdrop path from TMDB response
     * @param size - Image size (default: 'w1280')
     * @returns Full backdrop URL
     */
    getBackdropUrl(backdropPath: string | null, size: string = 'w1280'): string | null {
        if (!backdropPath) return null
        return `https://image.tmdb.org/t/p/${size}${backdropPath}`
    }

    /**
     * Get the title/name from a TMDB result
     * @param result - TMDB result object
     * @returns Title or name string
     */
    getResultTitle(result: TMDBResult): string {
        if ('title' in result) return result.title
        if ('name' in result) return result.name
        return 'Unknown'
    }

    /**
     * Get the date from a TMDB result
     * @param result - TMDB result object
     * @returns Date string or 'Unknown'
     */
    getResultDate(result: TMDBResult): string {
        if ('release_date' in result) return result.release_date
        if ('first_air_date' in result) return result.first_air_date
        return 'Unknown'
    }

    /**
     * Get the rating from a TMDB result
     * @param result - TMDB result object
     * @returns Rating number or null
     */
    getResultRating(result: TMDBResult): number | null {
        if ('vote_average' in result) return result.vote_average
        return null
    }
}

const tmdb = new TMDB()
export default tmdb