import { skipToken, useQuery } from "@tanstack/react-query"
import { mediaFolderFilesReadQueryOptions } from "@/lib/mediaFolderFiles"

export function useMediaFolderFilesQuery(folderPath: string | undefined) {
  const trimmed = folderPath?.trim() ?? ""
  const readOpts = trimmed ? mediaFolderFilesReadQueryOptions(trimmed) : null

  return useQuery<string[]>({
    queryKey: readOpts?.queryKey ?? (["associatedFiles", null] as const),
    queryFn: readOpts?.queryFn ?? skipToken,
    enabled: Boolean(trimmed),
    staleTime: 30_000,
  })
}
