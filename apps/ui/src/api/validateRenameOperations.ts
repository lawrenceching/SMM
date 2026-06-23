import type { RenameValidationResult } from '@core/types'
import { apiFetch } from '@/lib/apiFetch';

export interface ValidateRenameOperationsRequestBody {
  mediaFolderPath: string
  files: Array<{ from: string; to: string }>
  filesystemCheck?: boolean
}

export interface ValidateRenameOperationsResponseBody {
  data: RenameValidationResult | null
  error: string | null
}

export async function validateRenameOperationsApi(
  body: ValidateRenameOperationsRequestBody,
): Promise<ValidateRenameOperationsResponseBody> {
  const response = await apiFetch('/api/validateRenameOperations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    return {
      data: null,
      error: `HTTP ${response.status}: ${response.statusText}`,
    }
  }

  return (await response.json()) as ValidateRenameOperationsResponseBody
}
