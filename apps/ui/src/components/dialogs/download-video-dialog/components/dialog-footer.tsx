import { Button } from "@/components/ui/button"

export interface DialogFooterProps {
  startButtonDisabled: boolean
  formBusy: boolean
  /** Number of video list entries (used to decide whether to show the start button for multi-video). */
  videoListLength: number
  isEnqueueing: boolean
  onCancel: () => void
  onStart: () => void
  t: (key: string) => string
  tCommon: (key: string) => string
}

export function DialogFooter({
  startButtonDisabled,
  formBusy,
  videoListLength,
  isEnqueueing,
  onCancel,
  onStart,
  t,
  tCommon,
}: DialogFooterProps) {
  return (
    <>
      <Button
        data-testid="download-video-dialog-cancel"
        variant="outline"
        onClick={onCancel}
        disabled={formBusy}
      >
        {tCommon("cancel")}
      </Button>
      <Button
        data-testid="download-video-dialog-start"
        onClick={() => void onStart()}
        disabled={startButtonDisabled || (videoListLength > 0 && startButtonDisabled)}
      >
        {isEnqueueing ? t("downloadVideo.downloading") : t("downloadVideo.start")}
      </Button>
    </>
  )
}
