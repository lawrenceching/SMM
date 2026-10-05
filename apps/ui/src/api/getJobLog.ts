import { apiFetch } from '@/lib/apiFetch'
import type { CommandLogResponseMeta } from '@/api/commandLog'

const emptyLogMeta: CommandLogResponseMeta = {
  truncated: false,
  totalBytes: null,
  readOffset: null,
  readLimit: null,
}

interface GetJobLogResponseBody {
  data?: { lines: { message: string }[] }
  error?: string
}

/**
 * Fetches ImportFolderJob log lines via `POST /api/get-job-log`.
 */
export async function fetchJobLogText(
  jobId: string,
): Promise<{ text: string; meta: CommandLogResponseMeta }> {
  const res = await apiFetch('/api/get-job-log', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify({ id: jobId }),
  })
  if (!res.ok) {
    throw new Error(`HTTP Layer Error: ${res.status} ${res.statusText}`)
  }
  const body = (await res.json()) as GetJobLogResponseBody
  if (body.error) {
    throw new Error(body.error)
  }
  const text = (body.data?.lines ?? []).map((line) => line.message).join('\n')
  return { text, meta: emptyLogMeta }
}
