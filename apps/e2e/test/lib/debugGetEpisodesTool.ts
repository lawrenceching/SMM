const API_BASE_URL = 'http://localhost:30000'

export interface GetEpisodesToolOptions {
  mediaFolderPath: string
  clientId?: string
}

export interface EpisodeItem {
  season: number
  episode: number
  videoFilePath?: string
}

export interface GetEpisodesToolData {
  episodes: EpisodeItem[]
  totalCount: number
  showName: string
  numberOfSeasons: number
}

export interface DebugApiResponse<T = any> {
  success: boolean
  data?: T
  error?: string
}

export async function getEpisodesTool(
  options: GetEpisodesToolOptions,
): Promise<DebugApiResponse<GetEpisodesToolData>> {
  try {
    const response = await fetch(`${API_BASE_URL}/debug/getEpisodesTool`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(options),
    })

    return (await response.json()) as DebugApiResponse<GetEpisodesToolData>
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Unknown error',
    }
  }
}
