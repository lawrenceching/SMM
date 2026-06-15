const API_BASE_URL = 'http://localhost:30000'

export interface ListFilesToolOptions {
  mediaFolderPath: string
  recursively?: boolean
  videoFileOnly?: boolean
  clientId?: string
}

export interface ListFilesToolData {
  files: string[]
  count: number
}

export interface DebugApiResponse<T = any> {
  success: boolean
  data?: T
  error?: string
}

export async function listFilesTool(
  options: ListFilesToolOptions,
): Promise<DebugApiResponse<ListFilesToolData>> {
  try {
    const response = await fetch(`${API_BASE_URL}/debug/listFilesTool`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(options),
    })

    return (await response.json()) as DebugApiResponse<ListFilesToolData>
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Unknown error',
    }
  }
}
