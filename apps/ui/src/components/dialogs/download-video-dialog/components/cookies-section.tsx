import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Field, FieldGroup, FieldLabel, FieldError, FieldContent, FieldDescription } from "@/components/ui/field"
import {
  getCookiesBrowserIds,
  ytdlpCookiesBrowserLabelKey,
  type YtdlpCookiesBrowserId,
} from "@/lib/ytdlpCookiesBrowsers"

export interface CookiesSectionProps {
  useCookies: boolean
  cookiesText: string
  useCookiesFromBrowser: boolean
  cookiesBrowser: YtdlpCookiesBrowserId
  start1080pBlocked: boolean
  showCookiesRequiredError: boolean
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
  cookiesText,
  useCookiesFromBrowser,
  cookiesBrowser,
  start1080pBlocked,
  showCookiesRequiredError,
  formBusy,
  platform,
  onUseCookiesChange,
  onUseCookiesFromBrowserChange,
  onCookiesBrowserChange,
  onOpenCookiesEditor,
  t,
}: CookiesSectionProps) {
  const browserIds = getCookiesBrowserIds(platform)
  const cookiesEmpty = useCookies && !cookiesText.trim()
  const isInvalid = start1080pBlocked || showCookiesRequiredError

  return (

    <div>

      <FieldGroup className="w-full">
        <Field orientation="horizontal" data-invalid={isInvalid ? true : undefined}>
          <Checkbox
            id="download-video-use-cookies"
            data-testid="download-video-dialog-use-cookies-checkbox"
            aria-invalid={isInvalid}
            checked={useCookies}
            onCheckedChange={(checked) => onUseCookiesChange(checked === true)}
            disabled={formBusy}
          />
          <FieldContent>  
          <FieldLabel htmlFor="download-video-use-cookies">
            {t("downloadVideo.useCookiesLabel")}
          </FieldLabel>
          <FieldDescription className={cookiesEmpty ? 'text-red-500' : ''}>
            {
              cookiesEmpty ? t("downloadVideo.cookiesNotProvided") : '匿名时无法下载高清视频, 甚至无法下载视频'
            }          
          </FieldDescription>
          </FieldContent>
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
        </Field>

        <Field orientation="horizontal" data-invalid={isInvalid ? true : undefined}>
          <Checkbox
            id="download-video-use-cookies-from-browser"
            data-testid="download-video-dialog-use-cookies-from-browser-checkbox"
            aria-invalid={isInvalid}
            checked={useCookiesFromBrowser}
            onCheckedChange={(checked) => onUseCookiesFromBrowserChange(checked === true)}
            disabled={formBusy}
          />
          <FieldLabel htmlFor="download-video-use-cookies-from-browser">
            {t("downloadVideo.useCookiesFromBrowserLabel")}
          </FieldLabel>
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
          {start1080pBlocked && (
            <FieldError data-testid="download-video-dialog-1080p-auth-hint">
              {t("downloadVideo.format1080pAuthRequired")}
            </FieldError>
          )}
        </Field>
        {showCookiesRequiredError && (
          <FieldError data-testid="download-video-dialog-cookies-required-hint">
            {t("downloadVideo.cookiesRequiredForYoutube")}
          </FieldError>
        )}
      </FieldGroup>
    </div>

  )
}
