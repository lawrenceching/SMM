import { readFile } from "@/api/readFile"
import Nfo from "@/lib/nfo"
import type { MediaMetadata, TMDBTVShowDetails } from "@core/types"

/**
 * Extracts the path portion from a TMDB image URL.
 * Handles both full URLs (https://image.tmdb.org/t/p/{size}{path}) and paths that are already just the path.
 * 
 * @param urlOrPath - Full TMDB image URL or just the path
 * @returns The path portion (e.g., "/mNuV7Jti0jYQh34OP2WdmhflTDQ.jpg") or null if invalid
 */
function extractTmdbImagePath(urlOrPath: string | undefined | null): string | null {
    if (!urlOrPath) return null
    
    // If it's already just a path (starts with /), return it
    if (urlOrPath.startsWith('/')) {
        return urlOrPath
    }
    
    // If it's a full URL, extract the path portion
    // Pattern: https://image.tmdb.org/t/p/{size}{path}
    const tmdbImagePattern = /^https?:\/\/image\.tmdb\.org\/t\/p\/[^/]+(\/.+)$/
    const match = urlOrPath.match(tmdbImagePattern)
    
    if (match && match[1]) {
        return match[1]
    }
    
    // If it doesn't match the pattern, try to extract path from URL
    try {
        const url = new URL(urlOrPath)
        return url.pathname
    } catch {
        // If URL parsing fails, return null
        return null
    }
}

export function nfoToTmdbTVShowDetails(nfo: Nfo): TMDBTVShowDetails {
    // Parse TMDB ID
    const id = nfo.tmdbid ? parseInt(nfo.tmdbid, 10) : 0
    if (isNaN(id)) {
        console.warn(`[_nfoToTmdbTVShowDetails] Invalid tmdbid: ${nfo.tmdbid}, defaulting to 0`)
    }
    
    // Extract poster path from thumbs array (poster aspect, no season)
    let posterPath: string | null = null
    if (nfo.thumbs && nfo.thumbs.length > 0) {
        const posterThumb = nfo.thumbs.find(
            thumb => thumb.aspect === "poster" && thumb.season === undefined
        )
        if (posterThumb) {
            posterPath = extractTmdbImagePath(posterThumb.url)
        }
    }
    
    // Extract backdrop path from fanart
    const backdropPath = extractTmdbImagePath(nfo.fanart)
    
    // Build TMDBTVShowDetails object
    const tvShowDetails: TMDBTVShowDetails = {
        // Base TMDBTVShow fields
        id: isNaN(id) ? 0 : id,
        name: nfo.title || "",
        original_name: nfo.originalTitle || "",
        overview: nfo.plot || "",
        poster_path: posterPath,
        backdrop_path: backdropPath,
        first_air_date: "",
        vote_average: 0,
        vote_count: 0,
        popularity: 0,
        genre_ids: [],
        origin_country: [],
        media_type: 'tv',
        
        // TMDBTVShowDetails specific fields
        number_of_seasons: 0,
        number_of_episodes: 0,
        seasons: [],
        status: "",
        type: "",
        in_production: false,
        last_air_date: "",
        networks: [],
        production_companies: []
    }
    
    return tvShowDetails
}

export async function loadNfo(mediaMetadata: MediaMetadata): Promise<TMDBTVShowDetails | undefined> {
    const nfoFilePath = mediaMetadata.files?.find(file => file.endsWith('/tvshow.nfo'))

    if(nfoFilePath === undefined) {
        console.log(`[loadNfo] no nfo file found in media metadata`)
        return undefined
    }

    const resp = await readFile(nfoFilePath)

    if(resp.error) {
        console.error(`[loadNfo] Unable to read NFO file by calling readFile API`, resp)
        return undefined
    }

    if(resp.data === undefined) {
        console.error(`[loadNfo] Unexpected response body: no data`, resp)
        return undefined
    }

    const nfo = await Nfo.fromXml(resp.data)

    return nfoToTmdbTVShowDetails(nfo)
}