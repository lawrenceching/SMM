import { useQuery } from "@tanstack/react-query"
import type { MediaMetadata } from "@smm/types"
import { checkTaskCompletion } from "@/lib/scrapeDialog/checkTaskCompletion"
import type { ScrapeTaskId } from "@/lib/scrapeDialog"

export function scrapeTaskCompletionQueryKey(mediaFolderPath: string) {
  return ["scrape-task-completion", mediaFolderPath] as const
}

export function useScrapeTaskCompletionQuery(
  mediaMetadata: MediaMetadata | undefined,
  enabled: boolean,
) {
  const path = mediaMetadata?.mediaFolderPath ?? ""
  return useQuery({
    queryKey: scrapeTaskCompletionQueryKey(path),
    enabled: enabled && !!mediaMetadata?.mediaFolderPath,
    queryFn: () => checkTaskCompletion(mediaMetadata!),
    staleTime: 0,
  })
}

export type ScrapeTaskCompletion = Record<ScrapeTaskId, boolean>
