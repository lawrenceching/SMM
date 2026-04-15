import { useMutation, useQueryClient } from "@tanstack/react-query"
import type { MediaMetadata } from "@core/types"
import { mediaMetadataRepository } from "@/api/mediaMetadataRepository"
import { mediaMetadataQueryKey, normalizeMediaFolderPathForQuery } from "@/lib/mediaMetadataQueryKeys"
import type { UIMediaMetadata } from "@/types/UIMediaMetadata"

/** Thin persist + cache update. Full `hasDomainChanged` parity with legacy actions is deferred to migration. */
export function useUpdateMediaMetadataMutation() {
  const queryClient = useQueryClient()
  const mutation = useMutation({
    mutationFn: async (vars: {
      pathPosix: string
      metadata: MediaMetadata
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
      await mediaMetadataRepository.write(vars.metadata as UIMediaMetadata, vars.traceId ? { traceId: vars.traceId } : {})
      return { folderPathPosix: folder, metadata: vars.metadata }
    },
    onSuccess: ({ folderPathPosix, metadata }) => {
      queryClient.setQueryData<MediaMetadata>(
        mediaMetadataQueryKey(folderPathPosix),
        metadata,
      )
    },
  })

  const saveMediaMetadata = async (
    path: string,
    nextOrUpdater: MediaMetadata | ((prev: MediaMetadata) => MediaMetadata),
    options?: { traceId?: string },
  ): Promise<MediaMetadata> => {
    const pathPosix = normalizeMediaFolderPathForQuery(path)
    if (!pathPosix) {
      throw new Error("useUpdateMediaMetadataMutation: missing folder path")
    }

    const key = mediaMetadataQueryKey(pathPosix)
    const cached = queryClient.getQueryData<MediaMetadata>(key)
    const currentFromCacheOrRepo = cached ?? (await mediaMetadataRepository.read(pathPosix))
    const prev: MediaMetadata = {
      ...(currentFromCacheOrRepo as MediaMetadata),
    }

    const next =
      typeof nextOrUpdater === "function"
        ? nextOrUpdater(prev)
        : nextOrUpdater

    await mutation.mutateAsync({
      pathPosix,
      metadata: next,
      traceId: options?.traceId,
    })
    return next
  }

  return {
    ...mutation,
    saveMediaMetadata,
  }
}
