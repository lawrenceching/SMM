import { useCallback, useEffect, useState } from "react"
import { VideoCompressionDialog } from "@/components/dialogs"
import { useDialogs } from "@/providers/dialog-provider"
import { useFeatures } from "@/hooks/useFeatures"
import {
  UI_AskForVideoCompression,
  type OnAskForVideoCompressionEventData,
} from "@/types/eventTypes"

/**
 * Top-level owner of the video compression feature.
 *
 * Rendered once at App level and fully decoupled from the content panels:
 * TvShowPanel / MoviePanel / MusicPanel / the app menu only dispatch a
 * {@link UI_AskForVideoCompression} document event with the source video
 * context; this component owns
 *   - UI logic: dialog open/close state,
 *   - business logic: turning a request event into dialog context, wiring the
 *     folder/file picker, handling "select a source video" results, and
 *     gating on the `videoCompression` feature flag.
 */
export function VideoCompression() {
  const { filePickerDialog } = useDialogs()
  const [openFilePicker] = filePickerDialog
  const { isVideoCompressionEnabled } = useFeatures()

  const [isOpen, setIsOpen] = useState(false)
  const [request, setRequest] = useState<OnAskForVideoCompressionEventData>({})

  const openFromRequest = useCallback(
    (detail: OnAskForVideoCompressionEventData | undefined) => {
      if (!isVideoCompressionEnabled) return
      setRequest({
        filePath: detail?.filePath,
        title: detail?.title,
        duration: detail?.duration,
      })
      setIsOpen(true)
    },
    [isVideoCompressionEnabled],
  )

  const close = useCallback(() => {
    setIsOpen(false)
  }, [])

  useEffect(() => {
    const handler = (event: Event) => {
      openFromRequest((event as CustomEvent<OnAskForVideoCompressionEventData>).detail)
    }
    document.addEventListener(UI_AskForVideoCompression, handler)
    return () => {
      document.removeEventListener(UI_AskForVideoCompression, handler)
    }
  }, [openFromRequest])

  return (
    <VideoCompressionDialog
      isOpen={isOpen}
      onClose={close}
      filePath={request.filePath}
      title={request.title}
      duration={request.duration}
      onOpenFilePicker={openFilePicker}
      onSelectSource={(filePath: string) => {
        setRequest((prev) => ({ ...prev, filePath }))
      }}
    />
  )
}
