import { useEffect } from 'react'
import type { MediaMetadata } from '@core/types'
import type { QueryClient } from '@tanstack/react-query'
import {
  mediaMetadataQueryKey,
  normalizeMediaFolderPathForQuery,
} from '@/hooks/mediaMetadata'
import { mediaMetadataReadQueryOptions } from '@/lib/mediaMetadataQueryKeys'
import { findMediaMetadataForPath } from '@/ai/tools/mediaMetadataLookup'

let mediaMetadatas: MediaMetadata[] = []
let queryClientRef: QueryClient | null = null
let managedFolderPathsPosix = new Set<string>()

export function isMediaFolderManagedInUi(inputPath: string): boolean {
  const normalizedPath = normalizeMediaFolderPathForQuery(inputPath)
  return !!normalizedPath && managedFolderPathsPosix.has(normalizedPath)
}

export async function resolveMediaMetadataForFolderPath(
  inputPath: string,
): Promise<MediaMetadata | undefined> {
  const normalizedPath = normalizeMediaFolderPathForQuery(inputPath)
  if (!normalizedPath || !queryClientRef) {
    return undefined
  }

  if (!managedFolderPathsPosix.has(normalizedPath)) {
    return undefined
  }

  let mediaMetadata = findMediaMetadataForPath(mediaMetadatas, inputPath)
  if (!mediaMetadata) {
    try {
      mediaMetadata = await queryClientRef.fetchQuery(
        mediaMetadataReadQueryOptions(inputPath),
      )
    } catch {
      mediaMetadata = undefined
    }
  }

  return mediaMetadata
}

export function useMediaMetadataToolBridge(
  folders: Array<{ path: string }>,
  queryClient: QueryClient,
): void {
  useEffect(() => {
    queryClientRef = queryClient
    managedFolderPathsPosix = new Set(
      folders
        .map((folder) => normalizeMediaFolderPathForQuery(folder.path))
        .filter((p): p is string => !!p),
    )

    const refreshFromCache = () => {
      mediaMetadatas = folders
        .map((folder) => {
          const pathPosix = normalizeMediaFolderPathForQuery(folder.path)
          if (!pathPosix) return undefined
          return queryClient.getQueryData<MediaMetadata>(
            mediaMetadataQueryKey(pathPosix),
          )
        })
        .filter((metadata): metadata is MediaMetadata => metadata !== undefined)
    }

    refreshFromCache()
    return queryClient.getQueryCache().subscribe(refreshFromCache)
  }, [folders, queryClient])
}
