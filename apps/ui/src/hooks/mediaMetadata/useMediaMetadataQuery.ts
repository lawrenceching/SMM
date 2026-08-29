import { skipToken, useQuery } from "@tanstack/react-query"
import type { MediaMetadata } from "@core/types"
import { MetadataHttpError } from "@/api/metadata"
import { mediaMetadataReadQueryOptions } from "@/lib/mediaMetadataQueryKeys"

/** Query key when no folder path — `queryFn: skipToken` skips fetch; must not call `mediaMetadataReadQueryOptions("")`. */
const noFolderMediaMetadataQueryKey = ["mediaMetadata", null] as const

export interface UseMediaMetadataQueryOptions {
  defaultType?: MediaMetadata["type"]
}

export function useMediaMetadataQuery(path: string | undefined, _opts?: UseMediaMetadataQueryOptions) {
  const trimmed = path?.trim() ?? ""
  const readOpts = trimmed ? mediaMetadataReadQueryOptions(trimmed) : null

  return useQuery<MediaMetadata | null>({
    queryKey: readOpts?.queryKey ?? noFolderMediaMetadataQueryKey,
    queryFn: readOpts
      ? async (context) => {
          try {
            return await readOpts.queryFn(context)
          } catch (error) {
            if (error instanceof MetadataHttpError && error.status === 404) {
              return null
            }
            throw error
          }
        }
      : skipToken,
  })
}
