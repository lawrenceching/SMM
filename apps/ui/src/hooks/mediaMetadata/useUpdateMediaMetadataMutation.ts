import { useMutation, useQueryClient } from "@tanstack/react-query"
import type { MediaMetadata } from "@core/types"
import { mediaMetadataRepository } from "@/api/mediaMetadataRepository"
import type { UIMediaMetadata } from "@/types/UIMediaMetadata"
import { mediaMetadataQueryKey, normalizeMediaFolderPathForQuery } from "@/lib/mediaMetadataQueryKeys"

/** Thin persist + cache update. Full `hasDomainChanged` parity with legacy actions is deferred to migration. */
export function useUpdateMediaMetadataMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (vars: {
      pathPosix: string
      metadata: UIMediaMetadata
      traceId?: string
    }) => {
      const folder =
        normalizeMediaFolderPathForQuery(vars.pathPosix) ||
        (vars.metadata.mediaFolderPath
          ? normalizeMediaFolderPathForQuery(vars.metadata.mediaFolderPath)
          : "")
      if (!folder) {
        throw new Error("useUpdateMediaMetadataMutation: missing folder path")
      }
      await mediaMetadataRepository.write(vars.metadata, vars.traceId ? { traceId: vars.traceId } : {})
      return { folderPathPosix: folder, metadata: vars.metadata }
    },
    onSuccess: ({ folderPathPosix, metadata }) => {
      queryClient.setQueryData<MediaMetadata>(
        mediaMetadataQueryKey(folderPathPosix),
        metadata,
      )
    },
  })
}
