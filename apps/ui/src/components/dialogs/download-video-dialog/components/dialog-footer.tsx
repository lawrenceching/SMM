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
  formatsFetched: boolean
  quickjsUnavailable: boolean
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
  formatsFetched,
  quickjsUnavailable,
  onCancel,
  onStart,
  t,
  tCommon,
}: DialogFooterProps) {
  const startDisabled =
    !isUrlValid ||
    !downloadFolder.trim() ||
    formBusy ||
    !hasAgreed ||
    start1080pBlocked ||
    !formatsFetched ||
    quickjsUnavailable

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
              startDisabled || selectedCollectionUrlsSize === 0
            }
          >
            {isEnqueueing ? t("downloadVideo.downloading") : t("downloadVideo.start")}
          </Button>
        )
      ) : (
        <Button
          data-testid="download-video-dialog-start"
          onClick={() => void onStart()}
          disabled={startDisabled}
        >
          {isEnqueueing ? t("downloadVideo.downloading") : t("downloadVideo.start")}
        </Button>
      )}
    </>
  )
}
