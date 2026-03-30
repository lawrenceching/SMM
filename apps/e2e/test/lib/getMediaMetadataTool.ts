const API_BASE_URL = 'http://localhost:30000'

export interface GetMediaMetadataOptions {
  mediaFolderPath: string
  clientId?: string
}

export type MediaFolderType = 'tvshow-folder' | 'movie-folder' | 'music-folder'

export interface GetMediaMetadataData {
  mediaFolderPath: string
  type: MediaFolderType
  tvShow?: unknown
}

export interface DebugApiResponse<T = any> {
  success: boolean
  data?: T
  error?: string
}

export async function getMediaMetadata(
  options: GetMediaMetadataOptions,
): Promise<DebugApiResponse<GetMediaMetadataData>> {
  const { mediaFolderPath, clientId } = options

  try {
    const response = await fetch(`${API_BASE_URL}/debug/getMediaMetadata`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ mediaFolderPath, clientId }),
    })

    return (await response.json()) as DebugApiResponse<GetMediaMetadataData>
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Unknown error',
    }
  }
}
