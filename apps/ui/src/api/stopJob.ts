import { apiFetch } from '@/lib/apiFetch'

interface StopJobResponseBody {
  data?: { id: string }
  error?: string
}

/** Asks Core to abort an import job (`POST /api/stop-job`). */
export async function stopJobViaCore(id: string): Promise<void> {
  const resp = await apiFetch('/api/stop-job', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id }),
  })
  if (!resp.ok) {
    throw new Error(`HTTP Layer Error: ${resp.status} ${resp.statusText}`)
  }
  const body = (await resp.json()) as StopJobResponseBody
  if (body.error) {
    throw new Error(body.error)
  }
}
