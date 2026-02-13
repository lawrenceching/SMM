
/**
 * Get backdrop image URL
 * @param backdropPath - Backdrop path from TMDB response
 * @param size - Image size (default: 'w1280')
 * @returns Full backdrop URL
 */
export function getBackdropUrl(backdropPath: string | null, size: string = 'w1280'): string | null {
    if (!backdropPath) return null
    return `https://image.tmdb.org/t/p/${size}${backdropPath}`
}

/**
 * Get poster image URL
 * @param posterPath - Poster path from TMDB response
 * @param size - Image size (default: 'w500')
 * @returns Full poster URL
 */
export function getPosterUrl(posterPath: string | null, size: string = 'w500'): string | null {
    if (!posterPath) return null
    return `https://image.tmdb.org/t/p/${size}${posterPath}`
}
