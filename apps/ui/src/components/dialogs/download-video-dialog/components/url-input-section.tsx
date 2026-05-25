import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Spinner } from "@/components/ui/spinner"

export interface UrlInputSectionProps {
  url: string
  urlError: string | null
  formBusy: boolean
  disabled: boolean
  isListingFormats: boolean
  goDisabled: boolean
  onUrlChange: (value: string) => void
  onGo: () => void
  t: (key: string) => string
}

export function UrlInputSection({
  url,
  urlError,
  formBusy,
  disabled,
  isListingFormats,
  goDisabled,
  onUrlChange,
  onGo,
  t,
}: UrlInputSectionProps) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor="url">{t("downloadVideo.urlLabel")}</Label>
      <div className="flex gap-2">
        <Input
          data-testid="download-video-dialog-url-input"
          id="url"
          type="url"
          placeholder="https://www.youtube.com/watch?v=..."
          value={url}
          onChange={(e) => onUrlChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !goDisabled && !isListingFormats && !formBusy) {
              e.preventDefault()
              onGo()
            }
          }}
          disabled={formBusy || disabled}
          className={urlError ? "border-destructive" : ""}
        />
        <Button
          data-testid="download-video-dialog-go-button"
          size="icon"
          onClick={onGo}
          disabled={goDisabled || isListingFormats || formBusy}
          aria-label="Go"
        >
          {isListingFormats ? <Spinner className="h-4 w-4" /> : "Go"}
        </Button>
      </div>
      {urlError && <p className="text-sm text-destructive">{urlError}</p>}
    </div>
  )
}
