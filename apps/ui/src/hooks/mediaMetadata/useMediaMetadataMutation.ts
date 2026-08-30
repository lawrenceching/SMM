import { useMutation, useQueryClient } from "@tanstack/react-query"
import type { MediaMetadata } from "@core/types"
import {
  createMetadata,
  deleteMetadata,
  setMetadata,
  type MetadataPatch,
} from "@/api/metadata"
import {
  mediaMetadataQueryKey,
  normalizeMediaFolderPathForQuery,
  setPersistedMetadataQueryData,
} from "@/lib/mediaMetadataQueryKeys"

function requireMetadataPath(metadata: MediaMetadata): string {
  const path = normalizeMediaFolderPathForQuery(metadata.mediaFolderPath ?? "")
  if (!path) {
    throw new Error("useMediaMetadataMutation.create: missing mediaFolderPath")
  }
  return path
}

export function useMediaMetadataMutation() {
  const queryClient = useQueryClient()

  const createMutation = useMutation({
    mutationFn: createMetadata,
    onSuccess: (metadata, variables) => {
      setPersistedMetadataQueryData(
        queryClient,
        requireMetadataPath(metadata),
        metadata,
        variables,
      )
    },
  })

  const setMutation = useMutation({
    mutationFn: ({ path, patch }: { path: string; patch: MetadataPatch }) =>
      setMetadata(normalizeMediaFolderPathForQuery(path), patch),
    onSuccess: (metadata, { path }) => {
      setPersistedMetadataQueryData(
        queryClient,
        normalizeMediaFolderPathForQuery(path),
        metadata,
      )
    },
  })

  const removeMutation = useMutation({
    mutationFn: (path: string) =>
      deleteMetadata(normalizeMediaFolderPathForQuery(path)),
    onSuccess: (_data, path) => {
      queryClient.setQueryData(
        mediaMetadataQueryKey(normalizeMediaFolderPathForQuery(path)),
        null,
      )
    },
  })

  return {
    create: createMutation.mutateAsync,
    set: (path: string, patch: MetadataPatch) =>
      setMutation.mutateAsync({ path, patch }),
    remove: removeMutation.mutateAsync,
    deleteMetadata: removeMutation.mutateAsync,
    createMutation,
    setMutation,
    removeMutation,
  }
}
