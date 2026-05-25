import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  getCookiesBrowserIds,
  ytdlpCookiesBrowserLabelKey,
  type YtdlpCookiesBrowserId,
} from "@/lib/ytdlpCookiesBrowsers"

export interface CookiesSectionProps {
  useCookies: boolean
  useCookiesFromBrowser: boolean
  cookiesBrowser: YtdlpCookiesBrowserId
  start1080pBlocked: boolean
  formBusy: boolean
  platform: string
  onUseCookiesChange: (checked: boolean) => void
  onUseCookiesFromBrowserChange: (checked: boolean) => void
  onCookiesBrowserChange: (id: YtdlpCookiesBrowserId) => void
  onOpenCookiesEditor: () => void
  t: (key: string) => string
}

export function CookiesSection({
  useCookies,
  useCookiesFromBrowser,
  cookiesBrowser,
  start1080pBlocked,
  formBusy,
  platform,
  onUseCookiesChange,
  onUseCookiesFromBrowserChange,
  onCookiesBrowserChange,
  onOpenCookiesEditor,
  t,
}: CookiesSectionProps) {
  const browserIds = getCookiesBrowserIds(platform)

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <Checkbox
            id="download-video-use-cookies"
            data-testid="download-video-dialog-use-cookies-checkbox"
            aria-invalid={start1080pBlocked}
            checked={useCookies}
            onCheckedChange={(checked) => onUseCookiesChange(checked === true)}
            disabled={formBusy}
          />
          <Label htmlFor="download-video-use-cookies" className="cursor-pointer font-normal">
            {t("downloadVideo.useCookiesLabel")}
          </Label>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          data-testid="download-video-dialog-cookies-button"
          onClick={onOpenCookiesEditor}
          disabled={formBusy}
        >
          {t("downloadVideo.cookiesConfigure")}
        </Button>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <Checkbox
            id="download-video-use-cookies-from-browser"
            data-testid="download-video-dialog-use-cookies-from-browser-checkbox"
            aria-invalid={start1080pBlocked}
            checked={useCookiesFromBrowser}
            onCheckedChange={(checked) => onUseCookiesFromBrowserChange(checked === true)}
            disabled={formBusy}
          />
          <Label
            htmlFor="download-video-use-cookies-from-browser"
            className="cursor-pointer font-normal"
          >
            {t("downloadVideo.useCookiesFromBrowserLabel")}
          </Label>
        </div>
        <Select
          value={cookiesBrowser}
          onValueChange={(value) => onCookiesBrowserChange(value as YtdlpCookiesBrowserId)}
          disabled={formBusy || !useCookiesFromBrowser}
        >
          <SelectTrigger
            id="download-cookies-browser"
            data-testid="download-video-dialog-cookies-browser-select"
            className="h-8 w-[140px]"
            aria-label={t("downloadVideo.cookiesBrowserSelectLabel")}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {browserIds.map((id) => (
              <SelectItem key={id} value={id}>
                {t(ytdlpCookiesBrowserLabelKey(id))}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {start1080pBlocked && (
        <p
          className="text-xs text-destructive"
          data-testid="download-video-dialog-1080p-auth-hint"
        >
          {t("downloadVideo.format1080pAuthRequired")}
        </p>
      )}
    </div>
  )
}
