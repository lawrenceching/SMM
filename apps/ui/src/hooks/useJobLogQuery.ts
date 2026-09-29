import { useQuery } from '@tanstack/react-query'
import { fetchJobLogText } from '@/api/jobLogFile'
import type { CommandLogResponseMeta } from '@/api/commandLog'

export interface UseJobLogQueryArgs {
  jobId: string
  enabled: boolean
  isRunning: boolean
  refetchIntervalMs?: number
}

export interface UseJobLogQueryResult {
  data: { text: string; meta: CommandLogResponseMeta } | undefined
  isPending: boolean
  isFetching: boolean
  isError: boolean
  error: Error | null
  refetch: () => void
}

/** Polls `GET /api/job-log-file/:jobId` (`${logDir}/job-${jobId}.log`). */
export function useJobLogQuery({
  jobId,
  enabled,
  isRunning,
  refetchIntervalMs = 200,
}: UseJobLogQueryArgs): UseJobLogQueryResult {
  const query = useQuery({
    queryKey: ['job-log-file', jobId],
    enabled: !!jobId && enabled,
    refetchInterval: isRunning ? refetchIntervalMs : false,
    staleTime: isRunning ? 0 : Infinity,
    refetchOnWindowFocus: isRunning,
    queryFn: async () => fetchJobLogText(jobId),
  })

  return {
    data: query.data,
    isPending: query.isPending,
    isFetching: query.isFetching,
    isError: query.isError,
    error: query.error as Error | null,
    refetch: () => void query.refetch(),
  }
}
