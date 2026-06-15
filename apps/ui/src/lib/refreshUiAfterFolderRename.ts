import type { HelloResponseBody } from '@core/types'
import type { QueryClient } from '@tanstack/react-query'
import { Path } from '@core/path'
import { helloQueryKey } from '@/lib/appQueryKeys'
import {
  mediaMetadataQueryKey,
  normalizeMediaFolderPathForQuery,
} from '@/lib/mediaMetadataQueryKeys'
import { userConfigQueryKey } from '@/lib/userConfigQueryKeys'
import type { UIMediaFolder } from '@/types/UIMediaFolder'

export interface RefreshUiAfterFolderRenameParams {
  queryClient: QueryClient
  folders: UIMediaFolder[]
  setFolders: (folders: UIMediaFolder[]) => void
  setSelectedFolder: (path: string) => void
  from: string
  to: string
}

/**
 * Client-side refresh after a successful folder rename API call.
 * Used when Socket.IO events are unavailable or as a complement to broadcast.
 */
export async function refreshUiAfterFolderRename({
  queryClient,
  folders,
  setFolders,
  setSelectedFolder,
  from,
  to,
}: RefreshUiAfterFolderRenameParams): Promise<void> {
  setFolders(
    folders.map((folder) =>
      folder.path === from ? { ...folder, path: to } : folder,
    ),
  )
  setSelectedFolder(to)

  const hello = queryClient.getQueryData<HelloResponseBody>(helloQueryKey)
  if (hello?.userDataDir) {
    await queryClient.invalidateQueries({
      queryKey: userConfigQueryKey(hello.userDataDir),
    })
  }

  queryClient.removeQueries({
    queryKey: mediaMetadataQueryKey(normalizeMediaFolderPathForQuery(from)),
  })
  await queryClient.invalidateQueries({
    queryKey: mediaMetadataQueryKey(
      normalizeMediaFolderPathForQuery(Path.posix(to)),
    ),
  })
}
