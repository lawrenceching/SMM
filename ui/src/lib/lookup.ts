import { isNil, isNotNil } from 'es-toolkit';
import { extname, basename } from './path';
import { videoFileExtensions } from './utils';
import type { UIMediaMetadata } from '@/types/UIMediaMetadata';

/**
 * Find the video files for a given season and episode in various naming rules.
 * @param files The file paths in POSIX format
 * @param seasonNumber 
 * @param episodeNumber 
 */
/**
 * Check if a filename matches the given season and episode number using various naming patterns
 */
export function matchesEpisodePattern(filename: string, seasonNumber: number, episodeNumber: number): boolean {
    const upperFilename = filename.toUpperCase();
    const seasonStr = seasonNumber.toString().padStart(2, '0');
    const episodeStr = episodeNumber.toString().padStart(2, '0');
    const seasonStrNoPad = seasonNumber.toString();
    const episodeStrNoPad = episodeNumber.toString();
    
    // Pattern 1: SXXEYY (e.g., S01E05, S1E5)
    const patterns = [
        // Standard SXXEYY format (with and without padding)
        `S${seasonStr}E${episodeStr}`,
        `S${seasonStrNoPad}E${episodeStrNoPad}`,
        `S${seasonStr}E${episodeStrNoPad}`,
        `S${seasonStrNoPad}E${episodeStr}`,
        // With separators
        `S${seasonStr}.E${episodeStr}`,
        `S${seasonStrNoPad}.E${episodeStrNoPad}`,
        `S${seasonStr}xE${episodeStr}`,
        `S${seasonStrNoPad}xE${episodeStrNoPad}`,
        `S${seasonStr} E${episodeStr}`,
        `S${seasonStrNoPad} E${episodeStrNoPad}`,
        // Brackets format [SXXEYY] or [XXxYY]
        `[S${seasonStr}E${episodeStr}]`,
        `[S${seasonStrNoPad}E${episodeStrNoPad}]`,
        `[${seasonStr}x${episodeStr}]`,
        `[${seasonStrNoPad}x${episodeStrNoPad}]`,
        // Episode only (when season is 1 or not specified)
        seasonNumber === 1 ? `E${episodeStr}` : null,
        seasonNumber === 1 ? `E${episodeStrNoPad}` : null,
        seasonNumber === 1 ? `EP${episodeStr}` : null,
        seasonNumber === 1 ? `EP${episodeStrNoPad}` : null,
        seasonNumber === 1 ? `EPISODE ${episodeStr}` : null,
        seasonNumber === 1 ? `EPISODE ${episodeStrNoPad}` : null,
    ].filter(Boolean) as string[];
    
    // Check standard patterns
    for (const pattern of patterns) {
        if (upperFilename.includes(pattern.toUpperCase())) {
            return true;
        }
    }
    
    // Pattern 2: Chinese format 第X季第Y集 (e.g., 第1季第5集)
    const chinesePattern = `第${seasonNumber}季第${episodeNumber}集`;
    if (filename.includes(chinesePattern)) {
        return true;
    }
    
    // Pattern 3: Chinese format with zero-padding (e.g., 第01季第05集)
    const chinesePatternPadded = `第${seasonStr}季第${episodeStr}集`;
    if (filename.includes(chinesePatternPadded)) {
        return true;
    }
    
    // Pattern 4: Chinese format variations
    const chineseVariations = [
        `第${seasonNumber}季 第${episodeNumber}集`,
        `第${seasonStr}季 第${episodeStr}集`,
        `S${seasonNumber} 第${episodeNumber}集`,
        `S${seasonStr} 第${episodeStr}集`,
    ];
    for (const pattern of chineseVariations) {
        if (filename.includes(pattern)) {
            return true;
        }
    }
    
    // Pattern 5: Japanese format 第X話 (e.g., 第5話, 第05話)
    const japanesePatterns = [
        `第${episodeNumber}話`,
        `第${episodeStr}話`,
        `第${episodeNumber}回`,
        `第${episodeStr}回`,
        // Without 第 prefix
        `${episodeNumber}話`,
        `${episodeStr}話`,
        `${episodeNumber}回`,
        `${episodeStr}回`,
        // With season
        `S${seasonStr} 第${episodeNumber}話`,
        `S${seasonStrNoPad} 第${episodeNumber}話`,
        `S${seasonStr} 第${episodeStr}話`,
        `S${seasonStrNoPad} 第${episodeStr}話`,
        `S${seasonStr} 第${episodeNumber}回`,
        `S${seasonStrNoPad} 第${episodeNumber}回`,
        `S${seasonStr} 第${episodeStr}回`,
        `S${seasonStrNoPad} 第${episodeStr}回`,
        // Full Japanese text
        `シーズン${seasonNumber} エピソード${episodeNumber}`,
        `シーズン${seasonStr} エピソード${episodeStr}`,
        `シーズン${seasonNumber} 第${episodeNumber}話`,
        `シーズン${seasonStr} 第${episodeStr}話`,
    ];
    for (const pattern of japanesePatterns) {
        if (filename.includes(pattern)) {
            return true;
        }
    }
    
    // Pattern 6: Single season formats (when season is 1)
    // Patterns: " XX ", " #XX ", "- XX"
    if (seasonNumber === 1) {
        const singleSeasonPatterns = [
            // " XX " format (space-number-space)
            ` ${episodeStr} `,
            ` ${episodeStrNoPad} `,
            // Also handle at start/end: "XX " or " XX"
            `${episodeStr} `,
            `${episodeStrNoPad} `,
            ` ${episodeStr}`,
            ` ${episodeStrNoPad}`,
            // " #XX " format (space-hash-number-space)
            ` #${episodeStr} `,
            ` #${episodeStrNoPad} `,
            // Also handle at start: "#XX "
            `#${episodeStr} `,
            `#${episodeStrNoPad} `,
            // "- XX" format (dash-space-number)
            `- ${episodeStr}`,
            `- ${episodeStrNoPad}`,
        ];
        for (const pattern of singleSeasonPatterns) {
            if (filename.includes(pattern)) {
                return true;
            }
        }
    }
    
    return false;
}

export function lookup(files: string[], seasonNumber: number, episodeNumber: number): string | null {
    // 1. filter video files
    const videoFiles = files.filter(file => {
        const ext = extname(file).toLowerCase();
        return videoFileExtensions.includes(ext);
    });
    
    // 2. filter files by various episode naming patterns
    const matchingFiles = videoFiles.filter(file => {
        const filename = basename(file) || file;
        return matchesEpisodePattern(filename, seasonNumber, episodeNumber);
    });
    
    // 3. return the first file
    return matchingFiles.length > 0 ? matchingFiles[0] : null;
}

export function recognizeMediaFiles(mm: UIMediaMetadata): {
    season: number,
    episode: number,
    videoFilePath: string,
}[] {
    if(isNil(mm.files)) {
        return [];
    }

    if(isNil(mm.tmdbTvShow)) {
        return [];
    }

    const ret: {
        season: number,
        episode: number,
        videoFilePath: string,
    }[] = [];
    
    mm.tmdbTvShow.seasons.forEach(season => {
        season.episodes?.forEach(episode => {
            const videoFilePath = lookup(mm.files!, season.season_number, episode.episode_number);
            if(isNotNil(videoFilePath)) {
                ret.push({
                    season: season.season_number,
                    episode: episode.episode_number,
                    videoFilePath: videoFilePath,
                });
            }
        });
    });

    return ret;
}