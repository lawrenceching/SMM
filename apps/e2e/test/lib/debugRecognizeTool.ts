const API_BASE_URL = 'http://localhost:30000'

export interface CreateTaskOptions {
  mediaFolderPath: string
  clientId?: string
}

export interface AddFileOptions {
  taskId: string
  season: number
  episode: number
  path: string
  clientId?: string
}

export interface EndTaskOptions {
  taskId: string
  clientId?: string
}

export interface DebugApiResponse {
  success: boolean
  data?: any
  error?: string
}

export async function createTask(options: CreateTaskOptions): Promise<DebugApiResponse> {
  const { mediaFolderPath, clientId } = options

  try {
    const response = await fetch(`${API_BASE_URL}/debug/startRecognizeTask`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ mediaFolderPath, clientId }),
    })

    return (await response.json()) as DebugApiResponse
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Unknown error',
    }
  }
}

export async function addFile(options: AddFileOptions): Promise<DebugApiResponse> {
  const { taskId, season, episode, path, clientId } = options

  try {
    const response = await fetch(`${API_BASE_URL}/debug/addFileToRecognizeTask`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ taskId, season, episode, path, clientId }),
    })

    return (await response.json()) as DebugApiResponse
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Unknown error',
    }
  }
}

export async function endTask(options: EndTaskOptions): Promise<DebugApiResponse> {
  const { taskId, clientId } = options

  try {
    const response = await fetch(`${API_BASE_URL}/debug/endRecognizeTask`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ taskId, clientId }),
    })

    return (await response.json()) as DebugApiResponse
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Unknown error',
    }
  }
}
