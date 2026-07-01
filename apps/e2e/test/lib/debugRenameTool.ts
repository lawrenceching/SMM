const API_BASE_URL = 'http://localhost:30000'

export interface CreateTaskOptions {
  mediaFolderPath: string
  clientId?: string
}

export interface AddFileOptions {
  taskId: string
  from: string
  to: string
  clientId?: string
}

export interface EndTaskOptions {
  taskId: string
  clientId?: string
}

export interface DebugApiResponse {
  success: boolean
  data?: { taskId?: string; [key: string]: unknown }
  error?: string
}

export function requireTaskId(response: DebugApiResponse, label = 'createTask'): string {
  if (!response.success) {
    throw new Error(`${label} failed: ${response.error ?? 'unknown error'}`)
  }
  const taskId = response.data?.taskId
  if (!taskId) {
    throw new Error(`${label} failed: missing taskId in response: ${JSON.stringify(response)}`)
  }
  return taskId
}

export async function createTask(options: CreateTaskOptions): Promise<DebugApiResponse> {
  const { mediaFolderPath, clientId } = options

  try {
    const response = await fetch(`${API_BASE_URL}/debug/startRenameFilesTask`, {
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
  const { taskId, from, to, clientId } = options

  try {
    const response = await fetch(`${API_BASE_URL}/debug/addFileToRenameTask`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ taskId, from, to, clientId }),
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
    const response = await fetch(`${API_BASE_URL}/debug/endRenameFilesTask`, {
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
