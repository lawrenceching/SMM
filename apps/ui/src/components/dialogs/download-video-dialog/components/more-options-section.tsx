import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
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

  // Show extra args (write-thumbnail, embed-thumbnail, embed-metadata)
  showExtraArgs: boolean

  // JS Runtime
  useJsRuntime: boolean
  jsRuntime: YtdlpJsRuntimeId
  forceJsRuntime: boolean

  // Cookies (moved here after format fetch)
  showCookiesInMoreOptions: boolean
  url: string
  useCookies: boolean
  cookiesText: string
  useCookiesFromBrowser: boolean
  cookiesBrowser: YtdlpCookiesBrowserId
  platform: string
  start1080pBlocked: boolean
  showCookiesRequiredError: boolean
  youtubeCookiesHintEmphasized: boolean
  youtubeCookiesHintFlashKey: number

  onShowMoreOptionsChange: (checked: boolean) => void
  onExtraArgToggle: (id: YtdlpDownloadExtraArgId, enabled: boolean) => void
  onUseJsRuntimeChange: (checked: boolean) => void
  onJsRuntimeChange: (id: YtdlpJsRuntimeId) => void
  onUseCookiesChange: (checked: boolean) => void
  onUseCookiesFromBrowserChange: (checked: boolean) => void
  onCookiesBrowserChange: (id: YtdlpCookiesBrowserId) => void
  onOpenCookiesEditor: () => void

  // Proxy
  proxy: string
  onProxyChange: (value: string) => void

  t: (key: string) => string
}

export function MoreOptionsSection({
  showMoreOptions,
  extraArgSelection,
  formBusy,
  showExtraArgs,
  useJsRuntime,
  jsRuntime,
  forceJsRuntime,
  showCookiesInMoreOptions,
  url,
  useCookies,
  useCookiesFromBrowser,
  cookiesText,
  cookiesBrowser,
  platform,
  start1080pBlocked,
  showCookiesRequiredError,
  youtubeCookiesHintEmphasized,
  youtubeCookiesHintFlashKey,
  onShowMoreOptionsChange,
  onExtraArgToggle,
  onUseJsRuntimeChange,
  onJsRuntimeChange,
  onUseCookiesChange,
  onUseCookiesFromBrowserChange,
  onCookiesBrowserChange,
  onOpenCookiesEditor,
  proxy,
  onProxyChange,
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
                url={url}
                useCookies={useCookies}
                cookiesText={cookiesText}
                useCookiesFromBrowser={useCookiesFromBrowser}
                cookiesBrowser={cookiesBrowser}
                start1080pBlocked={start1080pBlocked}
                showCookiesRequiredError={showCookiesRequiredError}
                youtubeCookiesHintEmphasized={youtubeCookiesHintEmphasized}
                youtubeCookiesHintFlashKey={youtubeCookiesHintFlashKey}
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
          {showExtraArgs && YTDLP_DOWNLOAD_EXTRA_ARG_IDS.map((argId) => {
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

          {/* Proxy */}
          <div className="mt-2 pt-2 border-t flex flex-col gap-1">
            <Label htmlFor="download-video-proxy" className="font-normal">
              {t("downloadVideo.proxyLabel")}
            </Label>
            <Input
              id="download-video-proxy"
              data-testid="download-video-dialog-proxy-input"
              value={proxy}
              onChange={(e) => onProxyChange(e.target.value)}
              disabled={formBusy}
              placeholder="socks5://127.0.0.1:1080/"
              className="h-8"
            />
          </div>
        </div>
      )}
    </div>
  )
}
