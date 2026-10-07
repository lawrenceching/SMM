import { rpc, unwrapJson } from '@/lib/rpc'
import type { CommandLogResponseMeta } from '@/api/commandLog'

const emptyLogMeta: CommandLogResponseMeta = {
  truncated: false,
  totalBytes: null,
  readOffset: null,
  readLimit: null,
}

/**
 * Fetches ImportFolderJob log lines via `POST /api/get-job-log`.
 */
export async function fetchJobLogText(
  jobId: string,
): Promise<{ text: string; meta: CommandLogResponseMeta }> {
  const body = await unwrapJson(await rpc.api['get-job-log'].$post({ json: { id: jobId } }))
  if ('error' in body) {
    throw new Error(body.error)
  }
  const text = body.data.lines.map((line) => line.message).join('\n')
  return { text, meta: emptyLogMeta }
}
