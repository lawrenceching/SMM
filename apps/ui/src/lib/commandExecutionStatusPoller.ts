import { fetchCommandExecutionStatus } from '@/api/commandExecutionStatus'
import { getAllJobs, notifyIndexedDbUpdated, putJob } from '@/lib/downloadTaskDb'
import {
  getExecutionIdFromJobRecord,
  reconcileJobRecordWithCommandStatus,
} from '@/lib/reconcileJobRecordWithCommandStatus'

export const COMMAND_EXECUTION_STATUS_POLL_MS = 3_000

const inFlight = new Set<string>()

export async function pollCommandExecutionStatusAndReconcile(): Promise<void> {
  let records
  try {
    records = await getAllJobs()
  } catch {
    return
  }

  const running = records.filter((r) => r.status === 'running')
  await Promise.all(
    running.map(async (record) => {
      const executionId = getExecutionIdFromJobRecord(record)
      if (!executionId || inFlight.has(executionId)) return

      inFlight.add(executionId)
      try {
        const status = await fetchCommandExecutionStatus(executionId)
        const next = reconcileJobRecordWithCommandStatus(record, status)
        if (next) {
          await putJob(next)
          notifyIndexedDbUpdated()
        }
      } catch {
        // ignore transient network / CLI errors; next poll retries
      } finally {
        inFlight.delete(executionId)
      }
    }),
  )
}
