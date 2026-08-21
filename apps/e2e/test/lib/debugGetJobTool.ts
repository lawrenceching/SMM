const API_BASE_URL = 'http://localhost:30000'

export interface GetJobToolOptions {
  id: string
}

export interface GetJobToolData {
  job?: {
    kind: string
    id: string
    status: string
    folderPath?: string
    tasks?: Record<string, { status: string; error?: string }>
    error?: string
  }
  error?: string
}

export interface DebugApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
}

export async function getJobTool(
  options: GetJobToolOptions,
): Promise<DebugApiResponse<GetJobToolData>> {
  try {
    const response = await fetch(`${API_BASE_URL}/debug/getJobTool`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(options),
    })

    const data = (await response.json()) as DebugApiResponse<GetJobToolData>
    console.log('getJobTool response:' + JSON.stringify(data))
    return data
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('getJobTool error:', message)
    return {
      success: false,
      error: message,
    }
  }
}
