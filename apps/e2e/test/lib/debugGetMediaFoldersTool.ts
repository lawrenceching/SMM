const API_BASE_URL = 'http://localhost:30000'

export interface GetMediaFoldersOptions {
  clientId?: string
}

export interface GetMediaFoldersData {
  folders: string[]
}

export interface DebugApiResponse<T = any> {
  success: boolean
  data?: T
  error?: string
}

export async function getMediaFoldersTool(
  options: GetMediaFoldersOptions = {},
): Promise<DebugApiResponse<GetMediaFoldersData>> {
  try {
    const response = await fetch(`${API_BASE_URL}/debug/getMediaFolders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(options),
    })

    return (await response.json()) as DebugApiResponse<GetMediaFoldersData>
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Unknown error',
    }
  }
}
