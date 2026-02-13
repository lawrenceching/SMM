interface CleanUpResponse {
  success: boolean
  data?: {
    configDeleted?: boolean
    metadataDeleted?: boolean
  }
  error?: string
}

export async function cleanUp(): Promise<CleanUpResponse> {
  const resp = await fetch('/debug', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: 'cleanUp',
    }),
  })

  const body = await resp.json() as CleanUpResponse
  return body
}
