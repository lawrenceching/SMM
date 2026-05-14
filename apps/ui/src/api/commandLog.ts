
export type CommandLogFormat = 'raw' | 'segments'

export type CommandLogSegment = { kind: string; ts: string; body: string }

export type CommandLogSegmentsBody = {
  totalBytes: number
  truncated: boolean
  offset: number
  limit: number
  segments: CommandLogSegment[]
}

export type CommandLogResponseMeta = {
  truncated: boolean
  totalBytes: number | null
  readOffset: number | null
  readLimit: number | null
}

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

/** CLI returns 404 JSON when `main.log` does not exist yet; treat as empty so queries stay successful and can poll. */
function isCommandLogNotFoundResponse(res: Response, bodyText: string): boolean {
  if (res.status !== 404) return false
  try {
    const j = JSON.parse(bodyText) as { error?: string }
    return j?.error === 'Log not found'
  } catch {
    return bodyText.includes('Log not found')
  }
}

function buildCommandLogUrl(
  executionId: string,
  format: CommandLogFormat,
  range?: { offset?: number; limit?: number },
): string {
  const base = `/api/command-log/${encodeURIComponent(executionId)}`
  const q = new URLSearchParams()
  q.set('format', format)
  if (range?.offset !== undefined) q.set('offset', String(range.offset))
  if (range?.limit !== undefined) q.set('limit', String(range.limit))
  const qs = q.toString()
  return qs ? `${base}?${qs}` : base
}

export async function fetchCommandLogRaw(
  executionId: string,
  range?: { offset?: number; limit?: number },
): Promise<{ text: string; meta: CommandLogResponseMeta }> {
  const url = buildCommandLogUrl(executionId, 'raw', range)
  const res = await fetch(url, { credentials: 'same-origin' })
  const text = await res.text()
  if (!res.ok) {
    if (isCommandLogNotFoundResponse(res, text)) {
      return { text: '', meta: emptyLogMeta }
    }
    throw new Error(text || `HTTP ${res.status}`)
  }
  return { text, meta: readLogMeta(res) }
}

export async function fetchCommandLogSegments(
  executionId: string,
  range?: { offset?: number; limit?: number },
): Promise<{ body: CommandLogSegmentsBody; meta: CommandLogResponseMeta }> {
  const url = buildCommandLogUrl(executionId, 'segments', range)
  const res = await fetch(url, { credentials: 'same-origin' })
  const text = await res.text()
  if (!res.ok) {
    if (isCommandLogNotFoundResponse(res, text)) {
      const body: CommandLogSegmentsBody = {
        totalBytes: 0,
        truncated: false,
        offset: 0,
        limit: 0,
        segments: [],
      }
      return { body, meta: emptyLogMeta }
    }
    throw new Error(text || `HTTP ${res.status}`)
  }
  const meta = readLogMeta(res)
  const body = JSON.parse(text) as CommandLogSegmentsBody
  return { body, meta }
}
