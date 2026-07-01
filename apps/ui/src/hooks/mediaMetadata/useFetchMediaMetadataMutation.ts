import { useMutation, useQueryClient } from "@tanstack/react-query"
import type { MediaMetadata } from "@core/types"
import { mediaMetadataReadQueryOptions } from "@/lib/mediaMetadataQueryKeys"

export function useFetchMediaMetadataMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (vars: { path: string; traceId?: string }): Promise<MediaMetadata> => {
      const { queryKey, queryFn } = mediaMetadataReadQueryOptions(vars.path, { traceId: vars.traceId })
      return queryClient.fetchQuery({ queryKey, queryFn })
    },
  })
}
