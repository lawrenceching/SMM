import { useMediaMetadata } from "@/providers/media-metadata-provider"
import { useOnFolderSelected } from "./eventhandlers/onFolderSelected"
import { useDialogs } from "@/providers/dialog-provider"

export function useEventHandlers() {
  const { addMediaMetadata, updateMediaMetadata } = useMediaMetadata()
  const { configDialog } = useDialogs()

  const onFolderSelected = useOnFolderSelected(addMediaMetadata, updateMediaMetadata)

  const onRequireToOpenConfigDialog = () => {
    const [openConfig] = configDialog
    openConfig("ai")
  }

  return { onFolderSelected, onRequireToOpenConfigDialog }
}
