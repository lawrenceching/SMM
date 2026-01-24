import { useMediaMetadata } from "@/providers/media-metadata-provider"
import { useOnFolderSelected } from "./eventhandlers/onFolderSelected"

export function useEventHandlers() {
  const { addMediaMetadata, updateMediaMetadata } = useMediaMetadata()

  const onFolderSelected = useOnFolderSelected(addMediaMetadata, updateMediaMetadata)

  return { onFolderSelected }
}
