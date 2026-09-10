import { useCallback, useEffect, useState } from "react"
import { RenameFileDialog } from "@/components/dialogs"
import {
  UI_AskForRenameFile,
  type OnAskForRenameFileEventData,
  type RenameFileDialogOptions,
} from "@/types/eventTypes"

/**
 * Top-level owner of the single-file rename dialog (rendered once at App level).
 *
 * Renaming a file is transactional: requesters (TvShowPanel / MoviePanel
 * rename flows, episode-file context menu) dispatch a
 * {@link UI_AskForRenameFile} document event carrying their `onConfirm`
 * callback plus dialog options. This component owns the dialog UI state and
 * routes the confirmed new name back to the requester — decoupled from the
 * panels that request the rename.
 */
export function RenameFile() {
  const [isOpen, setIsOpen] = useState(false)
  const [options, setOptions] = useState<RenameFileDialogOptions>({})
  const [onConfirm, setOnConfirm] = useState<((newName: string) => void) | null>(null)

  const openFromRequest = useCallback((detail: OnAskForRenameFileEventData | undefined) => {
    if (!detail?.onConfirm) return
    setOnConfirm(() => detail.onConfirm)
    setOptions(detail.options ?? {})
    setIsOpen(true)
  }, [])

  const close = useCallback(() => {
    setIsOpen(false)
  }, [])

  const handleConfirm = useCallback(
    (newName: string) => {
      onConfirm?.(newName)
      close()
    },
    [onConfirm, close],
  )

  useEffect(() => {
    const handler = (event: Event) => {
      openFromRequest((event as CustomEvent<OnAskForRenameFileEventData>).detail)
    }
    document.addEventListener(UI_AskForRenameFile, handler)
    return () => {
      document.removeEventListener(UI_AskForRenameFile, handler)
    }
  }, [openFromRequest])

  return (
    <RenameFileDialog
      isOpen={isOpen}
      onClose={close}
      onConfirm={handleConfirm}
      initialValue={options.initialValue}
      title={options.title}
      description={options.description}
      suggestions={options.suggestions}
    />
  )
}
