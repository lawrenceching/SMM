import { FolderListItem, type FolderListItemProps } from "./FolderListItem"
import { useFolderListItem } from "@/hooks/useFolderListItem"

export type FolderListItemContainerProps = Omit<FolderListItemProps, "mediaName" | "mediaType" | "status">

export function FolderListItemContainer({
  path,
  ...handlers
}: FolderListItemContainerProps) {
  const { mediaName, mediaType, status } = useFolderListItem(path)

  return (
    <FolderListItem
      path={path}
      mediaName={mediaName}
      mediaType={mediaType}
      status={status}
      {...handlers}
    />
  )
}
