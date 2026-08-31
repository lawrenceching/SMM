import { useQuery } from "@tanstack/react-query"
import { getJobViaCore, type Job, type JobStatus } from "@/api/getJob"

const DEFAULT_POLL_INTERVAL_MS = 1000

export function jobQueryKey(jobId: string) {
  return ["job", jobId] as const
}

export function isJobTerminalStatus(status: JobStatus): boolean {
  return status === "succeeded" || status === "failed" || status === "aborted"
}

export interface UseJobQueryArgs {
  jobId: string | null | undefined
  /** When false, the query does not run. Defaults to true when `jobId` is set. */
  enabled?: boolean
  /** Poll interval in ms while the job is non-terminal. Defaults to 1000. */
  refetchIntervalMs?: number
}

export interface UseJobQueryResult {
  data: Job | undefined
  isPending: boolean
  isFetching: boolean
  isError: boolean
  error: Error | null
  isTerminal: boolean
}

/**
 * Polls Core `get-job` until the job reaches a terminal status
 * (`succeeded` | `failed` | `aborted`), then stops polling.
 */
export function useJobQuery({
  jobId,
  enabled = true,
  refetchIntervalMs = DEFAULT_POLL_INTERVAL_MS,
}: UseJobQueryArgs): UseJobQueryResult {
  const query = useQuery({
    queryKey: jobQueryKey(jobId ?? ""),
    enabled: !!jobId && enabled,
    staleTime: 0,
    refetchOnWindowFocus: false,
    queryFn: ({ signal }) => getJobViaCore(jobId!, signal),
    refetchInterval: (q) => {
      const status = q.state.data?.status
      if (status && isJobTerminalStatus(status)) {
        return false
      }
      return refetchIntervalMs
    },
  })

  const status = query.data?.status
  const isTerminal = status !== undefined && isJobTerminalStatus(status)

  return {
    data: query.data,
    isPending: query.isPending,
    isFetching: query.isFetching,
    isError: query.isError,
    error: query.error as Error | null,
    isTerminal,
  }
}
