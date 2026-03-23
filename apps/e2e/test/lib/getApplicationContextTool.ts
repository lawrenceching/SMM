const API_BASE_URL = 'http://localhost:30000'

export interface GetApplicationContextOptions {
  clientId?: string
}

export interface ApplicationContextData {
  selectedMediaFolder: string
  language: string
}

export interface DebugApiResponse<T = any> {
  success: boolean
  data?: T
  error?: string
}

export async function getApplicationContext(
  options: GetApplicationContextOptions = {},
): Promise<DebugApiResponse<ApplicationContextData>> {
  const { clientId } = options

  try {
    const response = await fetch(`${API_BASE_URL}/debug/getApplicationContext`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ clientId }),
    })

    const data = await response.json()
    console.log('getApplicationContext response:', data)

    return (data) as DebugApiResponse<ApplicationContextData>
  } catch (error: any) {
    console.error('getApplicationContext error:', error instanceof Error ? error.message : 'Unknown error')
    return {
      success: false,
      error: error.message || 'Unknown error',
    }
  }
}
