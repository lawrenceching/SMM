import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import {
  YTDLP_DOWNLOAD_EXTRA_ARG_IDS,
  ytdlpDownloadExtraArgLabelKey,
  type YtdlpDownloadExtraArgId,
  type YtdlpDownloadExtraArgSelection,
} from "@/lib/ytdlpDownloadExtraArgs"

export interface MoreOptionsSectionProps {
  showMoreOptions: boolean
  extraArgSelection: YtdlpDownloadExtraArgSelection
  formBusy: boolean
  onShowMoreOptionsChange: (checked: boolean) => void
  onExtraArgToggle: (id: YtdlpDownloadExtraArgId, enabled: boolean) => void
  t: (key: string) => string
}

export function MoreOptionsSection({
  showMoreOptions,
  extraArgSelection,
  formBusy,
  onShowMoreOptionsChange,
  onExtraArgToggle,
  t,
}: MoreOptionsSectionProps) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Checkbox
          id="download-video-more-options"
          data-testid="download-video-dialog-more-options-checkbox"
          checked={showMoreOptions}
          onCheckedChange={(checked) => onShowMoreOptionsChange(checked === true)}
          disabled={formBusy}
        />
        <Label htmlFor="download-video-more-options" className="cursor-pointer font-normal">
          {t("downloadVideo.moreOptions.label")}
        </Label>
      </div>
      {showMoreOptions && (
        <div className="ml-6 flex flex-col gap-2">
          {YTDLP_DOWNLOAD_EXTRA_ARG_IDS.map((argId) => {
            const inputId = `download-video-extra-${argId.slice(2)}`
            const testIdSuffix =
              argId === "--write-thumbnail"
                ? "write-thumbnail"
                : argId === "--embed-thumbnail"
                  ? "embed-thumbnail"
                  : "embed-metadata"
            return (
              <div key={argId} className="flex items-center gap-2">
                <Checkbox
                  id={inputId}
                  data-testid={`download-video-dialog-${testIdSuffix}-checkbox`}
                  checked={extraArgSelection[argId]}
                  onCheckedChange={(checked) => onExtraArgToggle(argId, checked === true)}
                  disabled={formBusy}
                />
                <Label htmlFor={inputId} className="cursor-pointer font-normal">
                  {t(ytdlpDownloadExtraArgLabelKey(argId))}
                </Label>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
