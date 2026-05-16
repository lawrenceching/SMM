export interface DownloadProbeUrlInput {
  url: string
  isUrlValid: boolean
  isCollectionUrl: boolean
  downloadCollectionVideos: boolean
  collectionEntries: ReadonlyArray<{ url: string }>
  selectedCollectionUrls: ReadonlySet<string>
  downloadEpisodes: boolean
  episodes: ReadonlyArray<{ url: string }>
  selectedEpisodeUrls: ReadonlySet<string>
}

/**
 * First URL that will be downloaded, used to probe yt-dlp formats (`-F`).
 */
export function getDownloadProbeUrl(input: DownloadProbeUrlInput): string | null {
  if (!input.isUrlValid) {
    return null
  }

  const trimmed = input.url.trim()
  if (!trimmed) {
    return null
  }

  if (input.isCollectionUrl && input.downloadCollectionVideos) {
    for (const entry of input.collectionEntries) {
      const u = entry.url.trim()
      if (u && input.selectedCollectionUrls.has(u)) {
        return u
      }
    }
    return null
  }

  if (input.downloadEpisodes) {
    for (const episode of input.episodes) {
      const u = episode.url.trim()
      if (u && input.selectedEpisodeUrls.has(u)) {
        return u
      }
    }
    return null
  }

  return trimmed
}
