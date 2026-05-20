import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export interface UrlInputSectionProps {
  url: string
  urlError: string | null
  formBusy: boolean
  disabled: boolean
  onUrlChange: (value: string) => void
  onUrlBlur: () => void
  t: (key: string) => string
}

export function UrlInputSection({
  url,
  urlError,
  formBusy,
  disabled,
  onUrlChange,
  onUrlBlur,
  t,
}: UrlInputSectionProps) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor="url">{t("downloadVideo.urlLabel")}</Label>
      <Input
        data-testid="download-video-dialog-url-input"
        id="url"
        type="url"
        placeholder="https://www.youtube.com/watch?v=..."
        value={url}
        onChange={(e) => onUrlChange(e.target.value)}
        onBlur={onUrlBlur}
        disabled={formBusy || disabled}
        className={urlError ? "border-destructive" : ""}
      />
      {urlError && <p className="text-sm text-destructive">{urlError}</p>}
    </div>
  )
}
