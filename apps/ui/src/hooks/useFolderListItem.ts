import { useMemo } from "react"
import { Path } from "@smm/utils/path"
import { useMediaMetadataQuery } from "@/hooks/mediaMetadata/useMediaMetadataQuery"
import { useUIMediaFolderStoreState } from "@/stores/uiMediaFolderStore"
import { buildMediaFolderListItemPropsFromFolderAndMetadata } from "@/lib/sidebarRowUtils"
import type { FolderListItemProps } from "@/components/sidebar/FolderListItem"
import type { UIMediaFolder } from "@/types/UIMediaFolder"

export type FolderListItemViewModel = Pick<FolderListItemProps, "mediaName" | "mediaType" | "status">

function uiMediaFolderForPath(path: string, folders: UIMediaFolder[]): UIMediaFolder {
  const posix = Path.posix(path)
  const existing = folders.find((f) => Path.posix(f.path) === posix)
  if (existing) return existing
  return {
    path: Path.toPlatformPath(path),
    status: "idle",
    test: false,
  }
}

export function useFolderListItem(path: string): FolderListItemViewModel {
  const { data: metadata, isPending } = useMediaMetadataQuery(path)
  const { folders } = useUIMediaFolderStoreState()

  const folder = useMemo(() => uiMediaFolderForPath(path, folders), [path, folders])

  const props = useMemo(
    () => buildMediaFolderListItemPropsFromFolderAndMetadata(folder, metadata ?? undefined),
    [folder, metadata],
  )

  const status =
    isPending && metadata === undefined && props.status === "idle" ? "loading" : props.status

  return {
    mediaName: props.mediaName,
    mediaType: props.mediaType,
    status,
  }
}
