import { Button } from "@/components/ui/button"

export interface DialogFooterProps {
  hasAgreed: boolean
  isUrlValid: boolean
  downloadFolder: string
  formBusy: boolean
  start1080pBlocked: boolean
  isCollectionUrl: boolean
  collectionEntriesLength: number
  selectedCollectionUrlsSize: number
  isEnqueueing: boolean
  onCancel: () => void
  onStart: () => void
  t: (key: string) => string
  tCommon: (key: string) => string
}

export function DialogFooter({
  hasAgreed,
  isUrlValid,
  downloadFolder,
  formBusy,
  start1080pBlocked,
  isCollectionUrl,
  collectionEntriesLength,
  selectedCollectionUrlsSize,
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
            disabled={
              !isUrlValid ||
              !downloadFolder.trim() ||
              formBusy ||
              !hasAgreed ||
              selectedCollectionUrlsSize === 0 ||
              start1080pBlocked
            }
          >
            {isEnqueueing ? t("downloadVideo.downloading") : t("downloadVideo.start")}
          </Button>
        )
      ) : (
        <Button
          data-testid="download-video-dialog-start"
          onClick={() => void onStart()}
          disabled={
            !isUrlValid ||
            !downloadFolder.trim() ||
            formBusy ||
            !hasAgreed ||
            start1080pBlocked
          }
        >
          {isEnqueueing ? t("downloadVideo.downloading") : t("downloadVideo.start")}
        </Button>
      )}
    </>
  )
}
