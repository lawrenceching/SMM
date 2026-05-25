import { Button } from "@/components/ui/button"

export interface DialogFooterProps {
  startButtonDisabled: boolean
  formBusy: boolean
  isCollectionUrl: boolean
  collectionEntriesLength: number
  isEnqueueing: boolean
  onCancel: () => void
  onStart: () => void
  t: (key: string) => string
  tCommon: (key: string) => string
}

export function DialogFooter({
  startButtonDisabled,
  formBusy,
  isCollectionUrl,
  collectionEntriesLength,
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
      {isCollectionUrl ? (
        collectionEntriesLength > 0 && (
          <Button
            data-testid="download-video-dialog-start"
            onClick={() => void onStart()}
            disabled={startButtonDisabled}
          >
            {isEnqueueing ? t("downloadVideo.downloading") : t("downloadVideo.start")}
          </Button>
        )
      ) : (
        <Button
          data-testid="download-video-dialog-start"
          onClick={() => void onStart()}
          disabled={startButtonDisabled}
        >
          {isEnqueueing ? t("downloadVideo.downloading") : t("downloadVideo.start")}
        </Button>
      )}
    </>
  )
}
