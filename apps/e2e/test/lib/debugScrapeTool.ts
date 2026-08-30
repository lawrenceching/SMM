const API_BASE_URL = 'http://localhost:30000'

export interface ScrapeToolOptions {
  path: string
  language?: string
}

export interface ScrapeToolData {
  id: string
  message: string
  error?: string
}

export interface DebugApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
}

export async function scrapeTool(
  options: ScrapeToolOptions,
): Promise<DebugApiResponse<ScrapeToolData>> {
  try {
    const response = await fetch(`${API_BASE_URL}/debug/scrapeTool`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(options),
    })

    const data = (await response.json()) as DebugApiResponse<ScrapeToolData>
    console.log('scrapeTool response:' + JSON.stringify(data))
    return data
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('scrapeTool error:', message)
    return {
      success: false,
      error: message,
    }
  }
}
