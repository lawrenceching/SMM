import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Field, FieldGroup, FieldLabel, FieldError, FieldContent } from "@/components/ui/field"
import {
  getCookiesBrowserIds,
  ytdlpCookiesBrowserLabelKey,
  type YtdlpCookiesBrowserId,
} from "@/lib/ytdlpCookiesBrowsers"
import { cn } from "@/lib/utils"
import {
  DOWNLOAD_VIDEO_COOKIES_WIKI_URL,
  getDownloadVideoCookiePlatformDisplayName,
} from "@core/download-video-cookie-platform"
import localStorages from "@/lib/localStorages"

export interface CookiesSectionProps {
  url: string
  useCookies: boolean
  cookiesText: string
  useCookiesFromBrowser: boolean
  cookiesBrowser: YtdlpCookiesBrowserId
  start1080pBlocked: boolean
  showCookiesRequiredError: boolean
  youtubeCookiesHintEmphasized?: boolean
  youtubeCookiesHintFlashKey?: number
  formBusy: boolean
  platform: string
  onUseCookiesChange: (checked: boolean) => void
  onUseCookiesFromBrowserChange: (checked: boolean) => void
  onCookiesBrowserChange: (id: YtdlpCookiesBrowserId) => void
  onOpenCookiesEditor: () => void
  t: (key: string, options?: Record<string, string>) => string
}

export function CookiesSection({
  url,
  useCookies,
  cookiesText,
  useCookiesFromBrowser,
  cookiesBrowser,
  start1080pBlocked,
  showCookiesRequiredError,
  youtubeCookiesHintEmphasized = false,
  youtubeCookiesHintFlashKey = 0,
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
  const checkboxInvalid = start1080pBlocked || showCookiesRequiredError
  const platformName = getDownloadVideoCookiePlatformDisplayName(url)
  const isYoutubeHint = platformName === "Youtube"
  const cookiesHint = t("downloadVideo.cookiesHint", { platformName })
  const tutorialLinkLabel = t("downloadVideo.cookiesHintTutorialLink")
  const hintEmphasized = isYoutubeHint && youtubeCookiesHintEmphasized
  const hintFlashing = isYoutubeHint && youtubeCookiesHintFlashKey > 0
  const guideUrl = localStorages.cookieGuideUrl ?? DOWNLOAD_VIDEO_COOKIES_WIKI_URL

  return (
    <div data-testid="download-video-dialog-cookies-section">
      <p
        key={hintFlashing ? youtubeCookiesHintFlashKey : "cookies-hint"}
        className={cn(
          "mb-3 text-sm",
          hintEmphasized ? "text-destructive" : "text-muted-foreground",
          hintFlashing && "animate-dvd-youtube-cookies-hint-flash",
        )}
        data-testid="download-video-dialog-cookies-hint"
        data-youtube-hint-emphasized={hintEmphasized ? "true" : "false"}
      >
        {cookiesHint}{" "}
        <a
          href={guideUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(
            "underline underline-offset-2",
            hintEmphasized
              ? "text-destructive hover:text-destructive/80"
              : "text-primary hover:text-primary/80",
          )}
          data-testid="download-video-dialog-cookies-tutorial-link"
        >
          {tutorialLinkLabel}
        </a>
      </p>

      <FieldGroup className="w-full">
        <Field orientation="horizontal" data-invalid={checkboxInvalid ? true : undefined}>
          <Checkbox
            id="download-video-use-cookies"
            data-testid="download-video-dialog-use-cookies-checkbox"
            aria-invalid={checkboxInvalid}
            checked={useCookies}
            onCheckedChange={(checked) => onUseCookiesChange(checked === true)}
            disabled={formBusy}
          />
          <FieldContent>
            <FieldLabel htmlFor="download-video-use-cookies">
              {t("downloadVideo.useCookiesLabel")}
            </FieldLabel>
            {cookiesEmpty && (
              <p className="text-sm text-red-500" data-testid="download-video-dialog-cookies-empty-hint">
                {t("downloadVideo.cookiesNotProvided")}
              </p>
            )}
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

        <Field orientation="horizontal" data-invalid={showCookiesRequiredError ? true : undefined}>
          <Checkbox
            id="download-video-use-cookies-from-browser"
            data-testid="download-video-dialog-use-cookies-from-browser-checkbox"
            aria-invalid={checkboxInvalid}
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
      </FieldGroup>
    </div>
  )
}
