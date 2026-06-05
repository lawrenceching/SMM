import { useQuery } from '@tanstack/react-query'
import {
  fetchCommandLogText,
  type CommandLogResponseMeta,
} from '@/api/commandLog'

/**
 * Polls the CLI `/api/command-log/:executionId` endpoint on a fixed interval.
 * Caller controls **when** to fetch via `enabled` and **how often** via `isRunning`.
 *
 * This is the **shared data-fetch layer** for command log consumption. Specific
 * parsers (e.g. yt-dlp progress JSON) should compose this hook with their own
 * derived logic.
 *
 * Query key `['command-log', executionId]` is shared across all consumers
 * (LogDialog, BackgroundJobsPopover, etc.), so multiple components observing
 * the same executionId only trigger one HTTP request.
 */
export interface UseCommandLogQueryArgs {
  executionId: string
  /** Whether the consumer is currently open/active. Drives `enabled`. */
  enabled: boolean
  /** When true, poll every `refetchIntervalMs`. When false, fetch only once. */
  isRunning: boolean
  /** Poll interval in ms. Defaults to 200. */
  refetchIntervalMs?: number
}

export interface UseCommandLogQueryResult {
  data: { text: string; meta: CommandLogResponseMeta } | undefined
  isPending: boolean
  isFetching: boolean
  isError: boolean
  error: Error | null
  refetch: () => void
}

export function useCommandLogQuery({
  executionId,
  enabled,
  isRunning,
  refetchIntervalMs = 200,
}: UseCommandLogQueryArgs): UseCommandLogQueryResult {
  const query = useQuery({
    queryKey: ['command-log', executionId],
    enabled: !!executionId && enabled,
    refetchInterval: isRunning ? refetchIntervalMs : false,
    staleTime: isRunning ? 0 : Infinity,
    refetchOnWindowFocus: isRunning,
    queryFn: async () => fetchCommandLogText(executionId),
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
