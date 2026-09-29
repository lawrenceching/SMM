import { apiFetch } from '@/lib/apiFetch'
import {
  type CommandLogResponseMeta,
} from '@/api/commandLog'

function readLogMeta(res: Response): CommandLogResponseMeta {
  return {
    truncated: res.headers.get('X-Log-Truncated') === 'true',
    totalBytes: res.headers.get('X-Log-Total-Bytes')
      ? Number.parseInt(res.headers.get('X-Log-Total-Bytes')!, 10)
      : null,
    readOffset: res.headers.get('X-Log-Read-Offset')
      ? Number.parseInt(res.headers.get('X-Log-Read-Offset')!, 10)
      : null,
    readLimit: res.headers.get('X-Log-Read-Limit')
      ? Number.parseInt(res.headers.get('X-Log-Read-Limit')!, 10)
      : null,
  }
}

const emptyLogMeta: CommandLogResponseMeta = {
  truncated: false,
  totalBytes: null,
  readOffset: null,
  readLimit: null,
}

function isJobLogNotFoundResponse(res: Response, bodyText: string): boolean {
  if (res.status !== 404) return false
  try {
    const j = JSON.parse(bodyText) as { error?: string }
    return j?.error === 'Log not found'
  } catch {
    return bodyText.includes('Log not found')
  }
}

/**
 * Fetches `${logDir}/job-${jobId}.log` via `GET /api/job-log-file/:jobId`.
 * A missing file is an empty log so the dialog can poll while import is starting.
 */
export async function fetchJobLogText(
  jobId: string,
): Promise<{ text: string; meta: CommandLogResponseMeta }> {
  const res = await apiFetch(`/api/job-log-file/${encodeURIComponent(jobId)}`, {
    credentials: 'same-origin',
  })
  const text = await res.text()
  if (!res.ok) {
    if (isJobLogNotFoundResponse(res, text)) {
      return { text: '', meta: emptyLogMeta }
    }
    throw new Error(text || `HTTP ${res.status}`)
  }
  return { text, meta: readLogMeta(res) }
}
