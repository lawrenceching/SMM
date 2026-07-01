import { skipToken, useQuery } from "@tanstack/react-query"
import type { MediaMetadata } from "@core/types"
import { mediaMetadataReadQueryOptions } from "@/lib/mediaMetadataQueryKeys"

/** Query key when no folder path — `queryFn: skipToken` skips fetch; must not call `mediaMetadataReadQueryOptions("")`. */
const noFolderMediaMetadataQueryKey = ["mediaMetadata", null] as const

export interface UseMediaMetadataQueryOptions {
  defaultType?: MediaMetadata["type"]
}

export function useMediaMetadataQuery(path: string | undefined, opts?: UseMediaMetadataQueryOptions) {
  const trimmed = path?.trim() ?? ""
  const readOpts = trimmed ? mediaMetadataReadQueryOptions(trimmed, { defaultType: opts?.defaultType }) : null

  return useQuery<MediaMetadata>({
    queryKey: readOpts?.queryKey ?? noFolderMediaMetadataQueryKey,
    queryFn: readOpts ? readOpts.queryFn : skipToken,
  })
}
