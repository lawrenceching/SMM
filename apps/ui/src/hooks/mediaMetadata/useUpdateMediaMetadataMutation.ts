import { useCallback } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import type { MediaMetadata } from "@core/types"
import {
  createMetadata,
  getMetadata,
  MetadataHttpError,
  setMetadata,
  type MetadataPatch,
} from "@/api/metadata"
import { mediaMetadataQueryKey, normalizeMediaFolderPathForQuery } from "@/lib/mediaMetadataQueryKeys"

function toMetadataPatch(metadata: MediaMetadata): MetadataPatch {
  return {
    type: metadata.type,
    mediaFiles: metadata.mediaFiles,
    tvShow: metadata.tvShow,
    movie: metadata.movie,
  }
}

/** Compatibility wrapper around the metadata HTTP RPC hooks. */
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
      let persisted: MediaMetadata
      try {
        persisted = await setMetadata(folder, toMetadataPatch(vars.metadata))
      } catch (error) {
        if (!(error instanceof MetadataHttpError) || error.status !== 404) {
          throw error
        }
        persisted = await createMetadata({
          ...vars.metadata,
          mediaFolderPath: folder,
        })
      }
      return { folderPathPosix: folder, metadata: persisted }
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
    const next =
      typeof nextOrUpdater === "function"
        ? nextOrUpdater({ ...(cached ?? (await getMetadata(pathPosix))) })
        : nextOrUpdater

    await mutation.mutateAsync({
      pathPosix,
      metadata: next,
      traceId: options?.traceId,
    })
    return next
  }

  const persistMediaMetadata = useCallback(
    async (path: string, metadata: MediaMetadata, options?: { traceId?: string }) => {
      const pathPosix = normalizeMediaFolderPathForQuery(path)
      if (!pathPosix) {
        throw new Error("useUpdateMediaMetadataMutation: missing folder path")
      }
      await mutation.mutateAsync({
        pathPosix,
        metadata,
        traceId: options?.traceId,
      })
    },
    [mutation],
  )

  return {
    ...mutation,
    saveMediaMetadata,
    persistMediaMetadata,
  }
}
