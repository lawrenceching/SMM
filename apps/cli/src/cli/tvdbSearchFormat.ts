import type { TVDBv4SearchResult } from '@smm/tvdb4'

export type TvdbSearchMediaType = 'series' | 'movie'

function releaseYear(item: TVDBv4SearchResult): string {
  const firstAir = typeof item.first_air_time === 'string' ? item.first_air_time : undefined
  const release = typeof item.release_date === 'string' ? item.release_date : undefined
  const year = typeof item.year === 'string' ? item.year : undefined
  return firstAir || release || year || ''
}

/**
 * Format TVDB search results for CLI stdout:
 * `#{index} {tvdb_id} {name} ({release date})` then overview on the next line.
 */
export function formatTvdbSearchResults(
  items: TVDBv4SearchResult[],
  _type: TvdbSearchMediaType,
): string {
  const lines: string[] = []
  for (let i = 0; i < items.length; i++) {
    const item = items[i]!
    const index = i + 1
    const id = item.tvdb_id || item.id || ''
    lines.push(`#${index} ${id} ${item.name} (${releaseYear(item)})`)
    lines.push(item.overview ?? '')
  }
  return lines.join('\n')
}
