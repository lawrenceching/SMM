import type { JobStatus } from '@/types/background-jobs'

/** Jobs that may be removed from the popover; only `running` is protected. */
export function isJobRemovable(status: JobStatus): boolean {
  return status !== 'running'
}
