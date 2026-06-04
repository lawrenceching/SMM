import { useQuery } from '@tanstack/react-query'
import {
  fetchCommandLogRaw,
  fetchCommandLogSegments,
  type CommandLogFormat,
  type CommandLogResponseMeta,
  type CommandLogSegment,
  type CommandLogSegmentsBody,
} from '@/api/commandLog'

/**
 * Polls the CLI `/api/command-log/:executionId` endpoint on a fixed interval.
 * Caller controls **when** to fetch via `enabled` and **how often** via `isRunning`.
 *
 * This is the **shared data-fetch layer** for command log consumption. Specific
 * parsers (e.g. yt-dlp progress JSON) should compose this hook with their own
 * derived logic.
 *
 * Query key `['command-log', executionId, format]` is shared across all
 * consumers (LogDialog, BackgroundJobsPopover, etc.), so multiple components
 * observing the same executionId only trigger one HTTP request.
 */
export interface UseCommandLogQueryArgs {
  executionId: string
  /** Whether the consumer is currently open/active. Drives `enabled`. */
  enabled: boolean
  /** When true, poll every `refetchIntervalMs`. When false, fetch only once. */
  isRunning: boolean
  /** Defaults to 'segments' for line-level parsing. */
  format?: CommandLogFormat
  /** Poll interval in ms. Defaults to 2000. */
  refetchIntervalMs?: number
}

export type CommandLogQueryData =
  | { kind: 'segments'; segments: CommandLogSegment[]; meta: CommandLogResponseMeta }
  | { kind: 'raw'; text: string; meta: CommandLogResponseMeta }

export interface UseCommandLogQueryResult {
  data: CommandLogQueryData | undefined
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
  format = 'segments',
  refetchIntervalMs = 2000,
}: UseCommandLogQueryArgs): UseCommandLogQueryResult {
  const query = useQuery({
    queryKey: ['command-log', executionId, format],
    enabled: !!executionId && enabled,
    refetchInterval: isRunning ? refetchIntervalMs : false,
    staleTime: isRunning ? 0 : Infinity,
    refetchOnWindowFocus: isRunning,
    queryFn: async (): Promise<CommandLogQueryData> => {
      if (format === 'raw') {
        const { text, meta } = await fetchCommandLogRaw(executionId)
        return { kind: 'raw', text, meta }
      }
      const { body, meta } = await fetchCommandLogSegments(executionId)
      return { kind: 'segments', segments: body.segments, meta }
    },
  })

  return {
    data: query.data as CommandLogQueryData | undefined,
    isPending: query.isPending,
    isFetching: query.isFetching,
    isError: query.isError,
    error: query.error as Error | null,
    refetch: () => void query.refetch(),
  }
}
