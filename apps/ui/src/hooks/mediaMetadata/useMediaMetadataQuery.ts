import { useQuery } from "@tanstack/react-query"
import type { MediaMetadata } from "@core/types"
import { mediaMetadataReadQueryOptions, normalizeMediaFolderPathForQuery } from "@/lib/mediaMetadataQueryKeys"

export function useMediaMetadataQuery(path: string | undefined) {
  const normalized = path ? normalizeMediaFolderPathForQuery(path) : ""
  const { queryKey, queryFn } = mediaMetadataReadQueryOptions(path ?? "")
  return useQuery<MediaMetadata>({
    queryKey,
    queryFn,
    enabled: Boolean(path && normalized),
  })
}
