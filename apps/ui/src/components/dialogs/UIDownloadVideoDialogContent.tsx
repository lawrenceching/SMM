import { Dialog, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import {
  ScrollableDialogBody,
  ScrollableDialogContent,
  ScrollableDialogFooter,
  ScrollableDialogHeader,
} from "@/components/ui/scrollable-dialog"
import type { YtdlpFormatPresetId } from "@/lib/ytdlpFormatPresets"
import type { YtdlpCookiesBrowserId } from "@/lib/ytdlpCookiesBrowsers"
import type { YtdlpJsRuntimeId } from "@/lib/ytdlpJsRuntimes"
import type {
  YtdlpDownloadExtraArgId,
  YtdlpDownloadExtraArgSelection,
} from "@/lib/ytdlpDownloadExtraArgs"
import type { YtdlpFormatCodeEntry } from "@/lib/ytdlpFormatCodes"
import { AgreementSection } from "./download-video-dialog/components/agreement-section"
import { UrlInputSection } from "./download-video-dialog/components/url-input-section"
import { CookiesSection } from "./download-video-dialog/components/cookies-section"
import { FormatSection } from "./download-video-dialog/components/format-section"
import { VideoListSection, type VideoListEntry } from "./download-video-dialog/components/video-list-section"
import { MoreOptionsSection } from "./download-video-dialog/components/more-options-section"
import { FolderSection } from "./download-video-dialog/components/folder-section"
import { DialogFooter } from "./download-video-dialog/components/dialog-footer"
import type { YtdlpFormatMode } from "@/lib/ytdlpFormatPresets"

export interface UIDownloadVideoDialogContentProps {
  hasAgreed: boolean
  isAgreementChecked: boolean
  onAgreementChange: (checked: boolean) => void

  url: string
  urlError: string | null
  formBusy: boolean
  onUrlChange: (value: string) => void
  onUrlBlur: () => void
  onGo: () => void

  // New: format listing
  isListingFormats: boolean
  listingError: string | null
  goDisabled: boolean

  useCookies: boolean
  cookiesText: string
  useCookiesFromBrowser: boolean
  cookiesBrowser: YtdlpCookiesBrowserId
  start1080pBlocked: boolean
  platform: string
  onUseCookiesChange: (checked: boolean) => void
  onUseCookiesFromBrowserChange: (checked: boolean) => void
  onCookiesBrowserChange: (id: YtdlpCookiesBrowserId) => void
  onOpenCookiesEditor: () => void

  isUrlValid: boolean
  selectedFormatPresetId: YtdlpFormatPresetId
  is1080pAvailable: boolean
  onFormatChange: (id: YtdlpFormatPresetId) => void

  // New: format mode & codes
  showCookiesAtTopLevel: boolean
  formatMode: YtdlpFormatMode
  formatCodes: YtdlpFormatCodeEntry[]
  selectedFormatCode: string
  selectedSupplementaryFormatCode: string
  onFormatModeChange: (mode: YtdlpFormatMode) => void
  onFormatCodeChange: (id: string) => void
  onSupplementaryFormatCodeChange: (id: string) => void

  // New: JS Runtime
  isYoutube: boolean
  useJsRuntime: boolean
  jsRuntime: YtdlpJsRuntimeId
  onUseJsRuntimeChange: (checked: boolean) => void
  onJsRuntimeChange: (id: YtdlpJsRuntimeId) => void

  // New: QuickJS availability
  quickjsUnavailable: boolean

  /** Callback to open the command log dialog for the listing error. */
  onOpenListingLog?: () => void
  /** Localized label for the log button (e.g. "Log" / "日志"). */
  listingLogButtonLabel?: string
  youtubeCookiesHintEmphasized: boolean
  youtubeCookiesHintFlashKey: number

  // Unified video list from playlist entries
  videoList: VideoListEntry[]
  selectedUrls: Set<string>
  onToggleUrl: (url: string) => void

  showMoreOptions: boolean
  extraArgSelection: YtdlpDownloadExtraArgSelection
  onShowMoreOptionsChange: (checked: boolean) => void
  onExtraArgToggle: (id: YtdlpDownloadExtraArgId, enabled: boolean) => void

  // Proxy
  proxy: string
  onProxyChange: (value: string) => void

  downloadFolder: string
  onFolderChange: (value: string) => void
  onFolderSelect: () => void

  isEnqueueing: boolean
  startButtonDisabled: boolean
  onCancel: () => void
  onStart: () => void

  onClose: () => void

  t: (key: string) => string
  tCommon: (key: string) => string
}

export function UIDownloadVideoDialogContent({
  hasAgreed,
  isAgreementChecked,
  onAgreementChange,

  url,
  urlError,
  formBusy,
  onUrlChange,
  onUrlBlur,
  onGo,

  isListingFormats,
  listingError,
  onOpenListingLog,
  listingLogButtonLabel,
  goDisabled,

  useCookies,
  cookiesText,
  useCookiesFromBrowser,
  cookiesBrowser,
  start1080pBlocked,
  platform,
  onUseCookiesChange,
  onUseCookiesFromBrowserChange,
  onCookiesBrowserChange,
  onOpenCookiesEditor,

  isUrlValid,
  selectedFormatPresetId,
  is1080pAvailable,
  onFormatChange,

  showCookiesAtTopLevel,
  formatMode,
  formatCodes,
  selectedFormatCode,
  selectedSupplementaryFormatCode,
  onFormatModeChange,
  onFormatCodeChange,
  onSupplementaryFormatCodeChange,

  isYoutube,
  useJsRuntime,
  jsRuntime,
  onUseJsRuntimeChange,
  onJsRuntimeChange,
  quickjsUnavailable,
  youtubeCookiesHintEmphasized,
  youtubeCookiesHintFlashKey,

  videoList,
  selectedUrls,
  onToggleUrl,

  showMoreOptions,
  extraArgSelection,
  onShowMoreOptionsChange,
  onExtraArgToggle,

  proxy,
  onProxyChange,

  downloadFolder,
  onFolderChange,
  onFolderSelect,

  isEnqueueing,
  startButtonDisabled,
  onCancel,
  onStart,

  onClose,

  t,
  tCommon,
}: UIDownloadVideoDialogContentProps) {
  const hasFetchedFormats = formatCodes.length > 0
  const showCookiesRequiredError = isYoutube && !useCookies && !useCookiesFromBrowser

  return (
    <Dialog open={true} onOpenChange={(open) => !open && onClose()}>
      <ScrollableDialogContent
        data-testid="download-video-dialog"
        showCloseButton={true}
        className="max-w-2xl overflow-hidden"
      >
        <ScrollableDialogHeader>
          <DialogTitle>{t("downloadVideo.title")}</DialogTitle>
          <DialogDescription>{t("downloadVideo.description")}</DialogDescription>
        </ScrollableDialogHeader>
        <ScrollableDialogBody>
          <div className="flex flex-col gap-4 px-1 py-2 pr-4">
            <AgreementSection
              hasAgreed={hasAgreed}
              isAgreementChecked={isAgreementChecked}
              onAgreementChange={onAgreementChange}
              t={t}
            />

            <UrlInputSection
              url={url}
              urlError={urlError}
              formBusy={formBusy}
              disabled={!hasAgreed}
              isListingFormats={isListingFormats}
              goDisabled={goDisabled}
              onUrlChange={onUrlChange}
              onUrlBlur={onUrlBlur}
              onGo={onGo}
              t={t}
            />

            {/* Listing error banner with log button */}
            {listingError && (
              <div className="flex items-start gap-2">
                <p
                  className="text-sm text-destructive flex-1"
                  data-testid="download-video-dialog-listing-error"
                >
                  {listingError}
                </p>
                {onOpenListingLog && (
                  <button
                    type="button"
                    className="shrink-0 rounded-md border border-border px-2 py-0.5 text-xs text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                    onClick={onOpenListingLog}
                    data-testid="download-video-dialog-listing-log-button"
                  >
                    {listingLogButtonLabel ?? 'Log'}
                  </button>
                )}
              </div>
            )}

            {/* QuickJS unavailable error */}
            {quickjsUnavailable && (
              <p
                className="text-sm text-destructive"
                data-testid="download-video-dialog-quickjs-unavailable"
              >
                JavaScript 运行时 QuickJS 不可用, 请尝试安装最新版本
              </p>
            )}

            {/* Cookies at top level (before format fetch) */}
            {hasAgreed && showCookiesAtTopLevel && (
              <>
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

                {/* More options (before format fetch): only JS runtime and proxy are visible */}
                <MoreOptionsSection
                  showMoreOptions={showMoreOptions}
                  extraArgSelection={extraArgSelection}
                  formBusy={formBusy}
                  showExtraArgs={false}
                  useJsRuntime={useJsRuntime}
                  jsRuntime={jsRuntime}
                  forceJsRuntime={isYoutube}
                  showCookiesInMoreOptions={false}
                  url={url}
                  useCookies={useCookies}
                  cookiesText={cookiesText}
                  useCookiesFromBrowser={useCookiesFromBrowser}
                  cookiesBrowser={cookiesBrowser}
                  platform={platform}
                  start1080pBlocked={start1080pBlocked}
                  showCookiesRequiredError={showCookiesRequiredError}
                  youtubeCookiesHintEmphasized={youtubeCookiesHintEmphasized}
                  youtubeCookiesHintFlashKey={youtubeCookiesHintFlashKey}
                  onShowMoreOptionsChange={onShowMoreOptionsChange}
                  onExtraArgToggle={onExtraArgToggle}
                  onUseJsRuntimeChange={onUseJsRuntimeChange}
                  onJsRuntimeChange={onJsRuntimeChange}
                  onUseCookiesChange={onUseCookiesChange}
                  onUseCookiesFromBrowserChange={onUseCookiesFromBrowserChange}
                  onCookiesBrowserChange={onCookiesBrowserChange}
                  onOpenCookiesEditor={onOpenCookiesEditor}
                  proxy={proxy}
                  onProxyChange={onProxyChange}
                  t={t}
                />
              </>
            )}

            {/* Format, video list, and more options — only after formats are fetched */}
            {hasAgreed && !showCookiesAtTopLevel && (
              <>
                <FormatSection
                  isUrlValid={isUrlValid}
                  hasFormats={hasFetchedFormats}
                  selectedFormatPresetId={selectedFormatPresetId}
                  is1080pAvailable={is1080pAvailable}
                  formBusy={formBusy}
                  formatMode={formatMode}
                  formatCodes={formatCodes}
                  selectedFormatCode={selectedFormatCode}
                  selectedSupplementaryFormatCode={selectedSupplementaryFormatCode}
                  hideFormatCodeUi={videoList.length > 0}
                  onFormatChange={onFormatChange}
                  onFormatModeChange={onFormatModeChange}
                  onFormatCodeChange={onFormatCodeChange}
                  onSupplementaryFormatCodeChange={onSupplementaryFormatCodeChange}
                  t={t}
                />

                <VideoListSection
                  entries={videoList}
                  selectedUrls={selectedUrls}
                  onToggleUrl={onToggleUrl}
                  formBusy={formBusy}
                  t={t}
                />

                <MoreOptionsSection
                  showMoreOptions={showMoreOptions}
                  extraArgSelection={extraArgSelection}
                  formBusy={formBusy}
                  showExtraArgs={true}
                  useJsRuntime={useJsRuntime}
                  jsRuntime={jsRuntime}
                  forceJsRuntime={isYoutube}
                  showCookiesInMoreOptions={true}
                  url={url}
                  useCookies={useCookies}
                  cookiesText={cookiesText}
                  useCookiesFromBrowser={useCookiesFromBrowser}
                  cookiesBrowser={cookiesBrowser}
                  platform={platform}
                  start1080pBlocked={start1080pBlocked}
                  showCookiesRequiredError={showCookiesRequiredError}
                  youtubeCookiesHintEmphasized={youtubeCookiesHintEmphasized}
                  youtubeCookiesHintFlashKey={youtubeCookiesHintFlashKey}
                  onShowMoreOptionsChange={onShowMoreOptionsChange}
                  onExtraArgToggle={onExtraArgToggle}
                onUseJsRuntimeChange={onUseJsRuntimeChange}
                onJsRuntimeChange={onJsRuntimeChange}
                onUseCookiesChange={onUseCookiesChange}
                onUseCookiesFromBrowserChange={onUseCookiesFromBrowserChange}
                onCookiesBrowserChange={onCookiesBrowserChange}
                onOpenCookiesEditor={onOpenCookiesEditor}
                proxy={proxy}
                onProxyChange={onProxyChange}
                t={t}
              />
              </>
            )}

            <FolderSection
              downloadFolder={downloadFolder}
              formBusy={formBusy}
              disabled={!hasAgreed}
              onFolderChange={onFolderChange}
              onFolderSelect={onFolderSelect}
              t={t}
            />
          </div>
        </ScrollableDialogBody>
        <ScrollableDialogFooter>
          <DialogFooter
            startButtonDisabled={startButtonDisabled}
            formBusy={formBusy}
            videoListLength={videoList.length}
            isEnqueueing={isEnqueueing}
            onCancel={onCancel}
            onStart={onStart}
            t={t}
            tCommon={tCommon}
          />
        </ScrollableDialogFooter>
      </ScrollableDialogContent>
    </Dialog>
  )
}
