const API_BASE_URL = 'http://localhost:30000'

export interface IsFolderExistToolOptions {
  path: string
  clientId?: string
}

export interface IsFolderExistToolData {
  exists: boolean
  path: string
  reason?: string
}

export interface DebugApiResponse<T = any> {
  success: boolean
  data?: T
  error?: string
}

export async function isFolderExistTool(
  options: IsFolderExistToolOptions,
): Promise<DebugApiResponse<IsFolderExistToolData>> {
  try {
    const response = await fetch(`${API_BASE_URL}/debug/isFolderExistTool`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(options),
    })

    return (await response.json()) as DebugApiResponse<IsFolderExistToolData>
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Unknown error',
    }
  }
}
