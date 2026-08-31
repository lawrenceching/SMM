import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { isNotNil } from "es-toolkit"
import type { HelloResponseBody, UserConfig } from "@smm/types"
import { Path } from "@smm/utils/path"
import { unimportFolder } from "@/api/unimportFolder"
import { defaultUserConfig } from "@/api/readUserConfig"
import { helloQueryKey } from "@/lib/appQueryKeys"
import { userConfigQueryKey } from "@/lib/userConfigQueryKeys"
import {
  mediaMetadataQueryKey,
  normalizeMediaFolderPathForQuery,
} from "@/lib/mediaMetadataQueryKeys"
import { useUIMediaFolderStore } from "@/stores/uiMediaFolderStore"
import type { MediaMetadata } from "@smm/types"
import { invalidateFoldersQueryIfV3 } from "./invalidateFoldersQuery"

function snapshotMetadata(queryClient: ReturnType<typeof useQueryClient>, paths: string[]) {
  return paths
    .map((path) => {
      const normalized = normalizeMediaFolderPathForQuery(path)
      if (!normalized) return undefined
      return queryClient.getQueryData<MediaMetadata>(mediaMetadataQueryKey(normalized))
    })
    .filter((m): m is NonNullable<typeof m> => m != null)
}

function applyOptimisticRemoval(
  queryClient: ReturnType<typeof useQueryClient>,
  dir: string,
  prev: UserConfig,
  paths: string[],
) {
  const deletedPosix = new Set(paths.map((p) => Path.posix(p)))
  const deletedNative = new Set(paths)

  paths.forEach((path) => {
    const normalized = normalizeMediaFolderPathForQuery(path)
    if (normalized) {
      queryClient.removeQueries({ queryKey: mediaMetadataQueryKey(normalized), exact: true })
    }
  })

  const newFolders = prev.folders
    .filter((f) => isNotNil(f))
    .filter((folder) => !deletedPosix.has(Path.posix(folder)))
  queryClient.setQueryData(userConfigQueryKey(dir), { ...prev, folders: newFolders })

  const st = useUIMediaFolderStore.getState()
  const nextUiFolders = st.folders.filter((folder) => !deletedPosix.has(Path.posix(folder.path)))
  const nextSelectedFolders = st.selectedFolders.filter((p) => !deletedNative.has(p))
  let nextPrimary = st.selectedFolder
  if (deletedNative.has(nextPrimary)) {
    nextPrimary = newFolders[0] ? Path.toPlatformPath(newFolders[0]) : ""
  }
  useUIMediaFolderStore.setState({
    folders: nextUiFolders,
    selectedFolders:
      nextSelectedFolders.length > 0 ? nextSelectedFolders : nextPrimary ? [nextPrimary] : [],
    selectedFolder: nextPrimary,
  })
}

export function useUnimportFolderMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (paths: string[]) => {
      if (paths.length === 0) return

      const helloData = queryClient.getQueryData<HelloResponseBody>(helloQueryKey)
      const dir = helloData?.userDataDir
      const prev =
        (dir ? queryClient.getQueryData<UserConfig>(userConfigQueryKey(dir)) : undefined) ??
        defaultUserConfig
      const removedMetadata = snapshotMetadata(queryClient, paths)
      const previousUiFolders = [...useUIMediaFolderStore.getState().folders]
      const prevUiSelection = {
        selectedFolder: useUIMediaFolderStore.getState().selectedFolder,
        selectedFolders: [...useUIMediaFolderStore.getState().selectedFolders],
      }

      if (dir) {
        applyOptimisticRemoval(queryClient, dir, prev, paths)
      }

      try {
        await Promise.all(
          paths.map(async (path) => {
            const resp = await unimportFolder(path)
            if (resp.error) throw new Error(resp.error)
          }),
        )
        invalidateFoldersQueryIfV3(queryClient)
      } catch (error) {
        if (dir) {
          queryClient.setQueryData(userConfigQueryKey(dir), prev)
        }
        removedMetadata.forEach((metadata) => {
          const folder = normalizeMediaFolderPathForQuery(metadata.mediaFolderPath || "")
          if (folder) {
            queryClient.setQueryData(mediaMetadataQueryKey(folder), metadata)
          }
        })
        useUIMediaFolderStore.setState({
          folders: previousUiFolders,
          selectedFolder: prevUiSelection.selectedFolder,
          selectedFolders: prevUiSelection.selectedFolders,
        })
        toast.error(
          error instanceof Error ? error.message : "Failed to delete selected folders. Changes reverted.",
        )
        throw error
      }
    },
  })
}
