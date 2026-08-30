const API_BASE_URL = 'http://localhost:30000'

export interface CreateRenameEpisodePlanOptions {
  mediaFolderPath: string
  files: Array<{
    from: string
    to: string
  }>
}

export interface DebugApiResponse {
  success: boolean
  data?: {
    planId: string
    plan: unknown
  }
  error?: string
}

export async function createRenameEpisodePlan(
  options: CreateRenameEpisodePlanOptions,
): Promise<DebugApiResponse> {
  const { mediaFolderPath, files } = options

  try {
    const response = await fetch(`${API_BASE_URL}/debug/createRenameEpisodePlan`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ mediaFolderPath, files }),
    })

    return (await response.json()) as DebugApiResponse
  } catch (error: unknown) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}
