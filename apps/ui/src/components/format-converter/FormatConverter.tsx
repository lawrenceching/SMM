import { useCallback, useEffect, useState } from "react"
import { FormatConverterDialog, type TrackProperties } from "@/components/dialogs"
import { useDialogs } from "@/providers/dialog-provider"
import { useFeatures } from "@/hooks/useFeatures"
import {
  UI_AskForFormatConverter,
  type OnAskForFormatConverterEventData,
} from "@/types/eventTypes"

/**
 * Top-level owner of the format-converter feature (rendered once at App level).
 *
 * TvShowPanel / MusicPanel / Welcome / the app menu only dispatch a
 * {@link UI_AskForFormatConverter} document event; this component owns the UI
 * state (dialog open/close), normalizes a request into the dialog's track
 * model, wires the file picker / source selection, and gates on the feature
 * flag — fully decoupled from the requesting panels.
 */
export function FormatConverter() {
  const { filePickerDialog } = useDialogs()
  const [openFilePicker] = filePickerDialog
  const { isFormatConverterEnabled } = useFeatures()

  const [isOpen, setIsOpen] = useState(false)
  const [track, setTrack] = useState<TrackProperties | undefined>(undefined)

  const openFromRequest = useCallback(
    (detail: OnAskForFormatConverterEventData | undefined) => {
      if (!isFormatConverterEnabled) return
      const filePath = detail?.filePath
      setTrack(
        filePath
          ? { id: 0, path: filePath, filePath, title: detail?.title ?? "" }
          : undefined,
      )
      setIsOpen(true)
    },
    [isFormatConverterEnabled],
  )

  const close = useCallback(() => {
    setIsOpen(false)
  }, [])

  useEffect(() => {
    const handler = (event: Event) => {
      openFromRequest((event as CustomEvent<OnAskForFormatConverterEventData>).detail)
    }
    document.addEventListener(UI_AskForFormatConverter, handler)
    return () => {
      document.removeEventListener(UI_AskForFormatConverter, handler)
    }
  }, [openFromRequest])

  return (
    <FormatConverterDialog
      isOpen={isOpen}
      onClose={close}
      track={track}
      onOpenFilePicker={openFilePicker}
      onSelectSource={(nextTrack: TrackProperties) => setTrack(nextTrack)}
    />
  )
}
