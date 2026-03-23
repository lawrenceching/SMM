const API_BASE_URL = 'http://localhost:30000'

export interface RenameFolderToolOptions {
  from: string
  to: string
}

export interface RenameFolderToolData {
  renamed: boolean
  from: string
  to: string
  error?: string
}

export interface DebugApiResponse<T = any> {
  success: boolean
  data?: T
  error?: string
}

export async function renameFolderTool(
  options: RenameFolderToolOptions,
): Promise<DebugApiResponse<RenameFolderToolData>> {
  const { from, to } = options

  try {
    const response = await fetch(`${API_BASE_URL}/debug/renameFolderTool`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from, to }),
    })

    const data = await response.json()
    console.log('renameFolderTool response:' + JSON.stringify(data))

    return (data) as DebugApiResponse<RenameFolderToolData>
  } catch (error: any) {
    console.error('renameFolderTool error:', error instanceof Error ? error.message : 'Unknown error')
    return {
      success: false,
      error: error.message || 'Unknown error',
    }
  }
}
