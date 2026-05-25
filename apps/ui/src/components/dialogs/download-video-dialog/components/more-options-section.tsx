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
  YTDLP_DOWNLOAD_EXTRA_ARG_IDS,
  ytdlpDownloadExtraArgLabelKey,
  type YtdlpDownloadExtraArgId,
  type YtdlpDownloadExtraArgSelection,
} from "@/lib/ytdlpDownloadExtraArgs"
import {
  YTDLP_JS_RUNTIME_IDS,
  ytdlpJsRuntimeLabelKey,
  type YtdlpJsRuntimeId,
} from "@/lib/ytdlpJsRuntimes"
import type { YtdlpCookiesBrowserId } from "@/lib/ytdlpCookiesBrowsers"
import { CookiesSection } from "./cookies-section"

export interface MoreOptionsSectionProps {
  showMoreOptions: boolean
  extraArgSelection: YtdlpDownloadExtraArgSelection
  formBusy: boolean

  // JS Runtime
  useJsRuntime: boolean
  jsRuntime: YtdlpJsRuntimeId
  forceJsRuntime: boolean

  // Cookies (moved here after format fetch)
  showCookiesInMoreOptions: boolean
  useCookies: boolean
  useCookiesFromBrowser: boolean
  cookiesBrowser: YtdlpCookiesBrowserId
  platform: string
  start1080pBlocked: boolean

  onShowMoreOptionsChange: (checked: boolean) => void
  onExtraArgToggle: (id: YtdlpDownloadExtraArgId, enabled: boolean) => void
  onUseJsRuntimeChange: (checked: boolean) => void
  onJsRuntimeChange: (id: YtdlpJsRuntimeId) => void
  onUseCookiesChange: (checked: boolean) => void
  onUseCookiesFromBrowserChange: (checked: boolean) => void
  onCookiesBrowserChange: (id: YtdlpCookiesBrowserId) => void
  onOpenCookiesEditor: () => void

  t: (key: string) => string
}

export function MoreOptionsSection({
  showMoreOptions,
  extraArgSelection,
  formBusy,
  useJsRuntime,
  jsRuntime,
  forceJsRuntime,
  showCookiesInMoreOptions,
  useCookies,
  useCookiesFromBrowser,
  cookiesBrowser,
  platform,
  start1080pBlocked,
  onShowMoreOptionsChange,
  onExtraArgToggle,
  onUseJsRuntimeChange,
  onJsRuntimeChange,
  onUseCookiesChange,
  onUseCookiesFromBrowserChange,
  onCookiesBrowserChange,
  onOpenCookiesEditor,
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
          {/* JS Runtime */}
          <div className="flex items-center gap-2">
            <Checkbox
              id="download-video-use-js-runtime"
              data-testid="download-video-dialog-use-js-runtime-checkbox"
              checked={useJsRuntime}
              onCheckedChange={(checked) => onUseJsRuntimeChange(checked === true)}
              disabled={formBusy || forceJsRuntime}
            />
            <Label htmlFor="download-video-use-js-runtime" className="cursor-pointer font-normal">
              {t("downloadVideo.useJsRuntimeLabel")}
            </Label>
          </div>
          {useJsRuntime && (
            <div className="ml-6">
              <Select
                value={jsRuntime}
                onValueChange={(value) => onJsRuntimeChange(value as YtdlpJsRuntimeId)}
                disabled={formBusy}
              >
                <SelectTrigger
                  id="download-js-runtime"
                  data-testid="download-video-dialog-js-runtime-select"
                  className="h-8 w-[160px]"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {YTDLP_JS_RUNTIME_IDS.map((id) => (
                    <SelectItem key={id} value={id}>
                      {t(ytdlpJsRuntimeLabelKey(id))}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Cookies (moved here after format fetch) */}
          {showCookiesInMoreOptions && (
            <div className="mt-2 pt-2 border-t">
              <CookiesSection
                useCookies={useCookies}
                useCookiesFromBrowser={useCookiesFromBrowser}
                cookiesBrowser={cookiesBrowser}
                start1080pBlocked={start1080pBlocked}
                formBusy={formBusy}
                platform={platform}
                onUseCookiesChange={onUseCookiesChange}
                onUseCookiesFromBrowserChange={onUseCookiesFromBrowserChange}
                onCookiesBrowserChange={onCookiesBrowserChange}
                onOpenCookiesEditor={onOpenCookiesEditor}
                t={t}
              />
            </div>
          )}

          {/* Extra args */}
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
