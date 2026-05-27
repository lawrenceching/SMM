import type { CommandExecutionStatusResponse } from '@/api/commandExecutionStatus'
import type { TaskJobRecord } from '@/lib/downloadTaskDb'

function parseJobData(record: TaskJobRecord): Record<string, unknown> {
  try {
    return JSON.parse(record.data || '{}') as Record<string, unknown>
  } catch {
    return {}
  }
}

export function getExecutionIdFromJobRecord(record: TaskJobRecord): string | undefined {
  const parsed = parseJobData(record)
  const id = parsed.executionId
  return typeof id === 'string' && id.length > 0 ? id : undefined
}

/**
 * When CLI reports a finished command while IDB still has `running`, return an updated record.
 * Returns null if no IDB write is needed.
 */
export function reconcileJobRecordWithCommandStatus(
  record: TaskJobRecord,
  status: CommandExecutionStatusResponse,
): TaskJobRecord | null {
  if (record.status !== 'running') return null
  if (status.phase !== 'finished' || !status.outcome) return null

  const now = Date.now()
  const parsed = parseJobData(record)
  const updated: TaskJobRecord = {
    ...record,
    updatedAt: now,
  }

  if (record.type === 'download-video') {
    const videos = Array.isArray(parsed.videos)
      ? (parsed.videos as Array<{ status?: string }>)
      : []

    if (status.outcome === 'failure') {
      for (const v of videos) {
        if (v.status === 'downloading') {
          v.status = 'failed'
        }
      }
      updated.status = 'failed'
      updated.data = JSON.stringify({ ...parsed, videos })
      return updated
    }

    let changed = false
    for (const v of videos) {
      if (v.status === 'downloading') {
        v.status = 'succeeded'
        changed = true
      }
    }
    if (!changed) return null
    updated.data = JSON.stringify({ ...parsed, videos })
    return updated
  }

  if (
    record.type === 'transcribe' ||
    record.type === 'translate' ||
    record.type === 'synthesize' ||
    record.type === 'process'
  ) {
    updated.status = status.outcome === 'success' ? 'succeeded' : 'failed'
    return updated
  }

  return null
}
