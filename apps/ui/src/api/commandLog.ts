import { rpc } from '@/lib/rpc'

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

/**
 * Fetches the raw main.log text for an execution. The CLI returns the
 * file contents as `text/plain` along with pagination/truncation
 * headers. No server-side structure is imposed — the UI parses
 * whatever it needs from the text (e.g. yt-dlp progress JSON).
 */
export async function fetchCommandLogText(
  executionId: string,
  range?: { offset?: number; limit?: number },
): Promise<{ text: string; meta: CommandLogResponseMeta }> {
  const query: { offset?: string; limit?: string } = {}
  if (range?.offset !== undefined) query.offset = String(range.offset)
  if (range?.limit !== undefined) query.limit = String(range.limit)
  const req: { param: { executionId: string }; query?: { offset?: string; limit?: string } } = {
    param: { executionId: encodeURIComponent(executionId) },
  }
  if (query.offset !== undefined) req.query = { offset: query.offset }
  if (query.limit !== undefined) req.query = { ...req.query, limit: query.limit }
  type CommandLogGetArgs = Parameters<
    (typeof rpc)['api']['command-log'][':executionId']['$get']
  >[0]
  const resp = await rpc.api['command-log'][':executionId'].$get(req as CommandLogGetArgs)
  if (!resp.ok) {
    const body = await resp.json()
    if (body.error === 'Log not found') {
      return { text: '', meta: emptyLogMeta }
    }
    throw new Error(body.error)
  }
  return { text: await resp.text(), meta: readLogMeta(resp) }
}
