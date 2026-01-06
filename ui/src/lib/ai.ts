import type { MediaFileMatchResult, MediaFileMetadata, TMDBTVShowDetails } from "@core/types"

function toMarkdown(tvShow: TMDBTVShowDetails) {
    const lines: string[] = []
    
    // Title
    lines.push(`# ${tvShow.name}`)
    lines.push('')
    
    // Original name if different
    if (tvShow.original_name && tvShow.original_name !== tvShow.name) {
        lines.push(`**Original Name:** ${tvShow.original_name}`)
        lines.push('')
    }
    
    // Overview
    if (tvShow.overview) {
        lines.push(`## Overview`)
        lines.push('')
        lines.push(tvShow.overview)
        lines.push('')
    }
    
    // Basic Information
    lines.push(`## Information`)
    lines.push('')
    if (tvShow.first_air_date) {
        lines.push(`- **First Air Date:** ${tvShow.first_air_date}`)
    }
    if (tvShow.last_air_date) {
        lines.push(`- **Last Air Date:** ${tvShow.last_air_date}`)
    }
    if (tvShow.status) {
        lines.push(`- **Status:** ${tvShow.status}`)
    }
    if (tvShow.type) {
        lines.push(`- **Type:** ${tvShow.type}`)
    }
    lines.push(`- **Number of Seasons:** ${tvShow.number_of_seasons}`)
    lines.push(`- **Number of Episodes:** ${tvShow.number_of_episodes}`)
    lines.push(`- **In Production:** ${tvShow.in_production ? 'Yes' : 'No'}`)
    if (tvShow.origin_country && tvShow.origin_country.length > 0) {
        lines.push(`- **Origin Country:** ${tvShow.origin_country.join(', ')}`)
    }
    lines.push('')
    
    // Ratings
    if (tvShow.vote_average > 0) {
        lines.push(`## Ratings`)
        lines.push('')
        lines.push(`- **Average Rating:** ${tvShow.vote_average.toFixed(1)}/10`)
        lines.push(`- **Vote Count:** ${tvShow.vote_count.toLocaleString()}`)
        lines.push(`- **Popularity:** ${tvShow.popularity.toFixed(1)}`)
        lines.push('')
    }
    
    // Networks
    if (tvShow.networks && tvShow.networks.length > 0) {
        lines.push(`## Networks`)
        lines.push('')
        tvShow.networks.forEach(network => {
            lines.push(`- ${network.name}`)
        })
        lines.push('')
    }
    
    // Production Companies
    if (tvShow.production_companies && tvShow.production_companies.length > 0) {
        lines.push(`## Production Companies`)
        lines.push('')
        tvShow.production_companies.forEach(company => {
            lines.push(`- ${company.name}`)
        })
        lines.push('')
    }
    
    // Seasons
    if (tvShow.seasons && tvShow.seasons.length > 0) {
        lines.push(`## Seasons`)
        lines.push('')
        tvShow.seasons.forEach(season => {
            lines.push(`### ${season.name || `Season ${season.season_number}`}`)
            lines.push('')
            if (season.overview) {
                lines.push(season.overview)
                lines.push('')
            }
            lines.push(`- **Season Number:** ${season.season_number}`)
            lines.push(`- **Episode Count:** ${season.episode_count}`)
            if (season.air_date) {
                lines.push(`- **Air Date:** ${season.air_date}`)
            }
            lines.push('')
            
            // Episodes
            if (season.episodes && season.episodes.length > 0) {
                lines.push(`#### Episodes`)
                lines.push('')
                season.episodes.forEach(episode => {
                    lines.push(`**Episode ${episode.episode_number}: ${episode.name || 'Untitled'}**`)
                    if (episode.air_date) {
                        lines.push(`- Air Date: ${episode.air_date}`)
                    }
                    if (episode.runtime) {
                        lines.push(`- Runtime: ${episode.runtime} minutes`)
                    }
                    if (episode.vote_average > 0) {
                        lines.push(`- Rating: ${episode.vote_average.toFixed(1)}/10 (${episode.vote_count} votes)`)
                    }
                    if (episode.overview) {
                        lines.push(`- ${episode.overview}`)
                    }
                    lines.push('')
                })
            }
        })
    }
    
    return lines.join('\n')
}

function toDisplayString(tvShow: TMDBTVShowDetails) {
    return toMarkdown(tvShow)
}

export const templates = {
    /**
     * Ask AI to guess the media name from the folder name
     * @param folderName
     */
    mediaName: function(folderName: string) {
        return `This is a media folder name:
${folderName}
Tell me the possible TVShow name in TMDB in zh-CN.
You should answer ONLY the name, no other text.
If no possible TVShow name is found, answer empty text.
        `
    },

    matchFilesToEpisode: function(files: string[], tvShow: TMDBTVShowDetails) {
        return `You're an assistant for a media manager.
        You will be given a list of local files and media information.
        
        The files are:
        ${files.join("\n")}
        
        The media is:
        ${toDisplayString(tvShow)}
        
        You need to find the local file for each episode given above.
        You should answer for each file in below format, which represents the season number and episode number, followed by file name.
        {SXXEXX}:{file}
        For example:
        S01E01:/path/to/file1.mp4
        S01E02:/path/to/file2.mp4
        S01E03:/path/to/file3.mp4
        or in Windows platform:
        S01E04:C:\\path\\to\\file4.mp4
        S01E05:\\\\NetworkVolumn\\to\\file5.mp4
        
        You should answer ONLY the matches, no other text.
        If one file does not match any episode, ignore it.`
    },

    matchFilesToEpisodeForGeneratingObject: function(files: string[], tvShow: TMDBTVShowDetails) {
return `You're an assistant for a media manager.
You will be given a list of local files and media information.

The files are:
${files.join("\n")}

The media is:
${toDisplayString(tvShow)}

You need to match the local files to each episodes and return the result in JSON format.
`
    }
}

/**
 * 
 * @param tvshow 
 * @param files File paths in POSIX format
 * @param matches 
 */
export function generateMediaFileMetadatas(files: string[], matches: MediaFileMatchResult[]) {
    const mediaFiles: MediaFileMetadata[] = []

    matches.forEach(match => {
        const file = files.find(file => file === match.path)

        if(!file) {
            console.error(`[generateMediaFileMetadatas] File not found: ${match.path}`)
            return;
        }

        const mediaFile: MediaFileMetadata = {
            absolutePath: file,
            seasonNumber: parseInt(match.seasonNumber),
            episodeNumber: parseInt(match.episodeNumber),
        }

        mediaFiles.push(mediaFile)
    })

    console.log(`[generateMediaFileMetadatas] generated media files: `, mediaFiles)

    return mediaFiles;

}