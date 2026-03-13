import { extname, basename } from './path';
import { videoFileExtensions } from './utils';


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
            // When season is 1, episode-only patterns (e.g. E01, EP01) must not match files that explicitly indicate season 0 (e.g. S00E01)
            if (seasonNumber === 1 && !pattern.toUpperCase().startsWith('S') && upperFilename.includes('S00')) {
                continue;
            }
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
    // Do not match files that explicitly indicate season 0 (e.g. S00E01)
    if (seasonNumber === 1) {
        if (upperFilename.includes('S00')) {
            return false;
        }
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

    // 2. exclude OP/ED/MENU files
    const nonOpEdFiles = videoFiles.filter(file => {
        const filename = (basename(file) || file).toUpperCase();
        return !filename.includes('OP') && !filename.includes('ED') && !filename.includes('MENU');
    });

    // 3. exclude specials folder files for non-zero seasons
    const filteredFiles = nonOpEdFiles.filter(file => {
        if (seasonNumber === 0) return true;
        const upperPath = file.toUpperCase();
        return !upperPath.includes('/SPS/') &&
               !upperPath.includes('/SP/') &&
               !upperPath.includes('/SPEICALS') &&
               !upperPath.includes('/EXTRAS/') &&
               !file.includes('/特典') &&
               !file.includes('/映像特典');
    });

    // 4. filter files by various episode naming patterns
    const matchingFiles = filteredFiles.filter(file => {
        const filename = basename(file) || file;
        return matchesEpisodePattern(filename, seasonNumber, episodeNumber);
    });

    // 5. return the first file
    return matchingFiles.length > 0 ? matchingFiles[0] : null;
}
