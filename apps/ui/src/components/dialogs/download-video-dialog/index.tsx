import { useCallback } from "react"
import type { DownloadVideoDialogProps, FileItem } from "../types"
import { useTranslation, castTranslationFn } from "@/lib/i18n"
import { useDownloadVideoForm } from "../hooks/use-download-video-form"
import { useYtdlpDownloadFlow } from "../hooks/use-ytdlp-download-flow"
import { UIDownloadVideoDialogContent } from "../UIDownloadVideoDialogContent"

export function DownloadVideoDialogContent({
  isOpen: _isOpen,
  onClose,
  onOpenFilePicker,
  destinationFolder,
}: DownloadVideoDialogProps) {
  const { t } = useTranslation("dialogs")
  const { t: tCommon } = useTranslation("common")

  const td = castTranslationFn(t)
  const tdCommon = castTranslationFn(tCommon)

  const form = useDownloadVideoForm({ isOpen: true, destinationFolder, t: td })

  const flow = useYtdlpDownloadFlow({
    isOpen: true,
    hasAgreed: form.hasAgreed,
    url: form.url,
    isCollectionUrl: form.isCollectionUrl,
    canDownloadEpisodes: form.canDownloadEpisodes,
    downloadFolder: form.downloadFolder,
    selectedFormatPresetId: form.selectedFormatPresetId,
    useCookies: form.useCookies,
    cookiesText: form.cookiesText,
    useCookiesFromBrowser: form.useCookiesFromBrowser,
    cookiesBrowser: form.cookiesBrowser,
    showMoreOptions: form.showMoreOptions,
    extraArgSelection: form.extraArgSelection,
    formatMode: form.formatMode,
    selectedFormatCode: form.selectedFormatCode,
    selectedSupplementaryFormatCode: form.selectedSupplementaryFormatCode,
    useJsRuntime: form.useJsRuntime,
    jsRuntime: form.jsRuntime,
    onClose,
    t: td,
  })

  const startButtonDisabled =
    !form.isUrlValid ||
    !form.downloadFolder.trim() ||
    flow.formBusy ||
    !form.hasAgreed ||
    form.start1080pBlocked ||
    form.showCookiesAtTopLevel ||
    form.quickjsUnavailable ||
    (form.isYoutube && !form.useCookies && !form.useCookiesFromBrowser) ||
    (form.useCookies && !form.cookiesText.trim()) ||
    (form.isCollectionUrl && flow.selectedCollectionUrls.size === 0)

  const hideFormatCodeUi =
    flow.downloadEpisodes || flow.downloadCollectionVideos

  const handleFolderSelect = useCallback(() => {
    onOpenFilePicker(
      (file: FileItem) => form.setDownloadFolder(file.path),
      { selectFolder: true, initialPath: form.downloadFolder || undefined },
    )
  }, [onOpenFilePicker, form.setDownloadFolder, form.downloadFolder])

  const handleCancel = useCallback(() => {
    form.resetFormState()
    flow.resetFlowState()
    onClose()
  }, [form.resetFormState, flow.resetFlowState, onClose])

  return (
    <UIDownloadVideoDialogContent
      hasAgreed={form.hasAgreed}
      isAgreementChecked={form.isAgreementChecked}
      onAgreementChange={form.handleAgreementChange}
      url={form.url}
      urlError={form.urlError}
      formBusy={flow.formBusy}
      onUrlChange={form.handleUrlChange}
      onGo={form.handleGo}
      isListingFormats={form.isListingFormats}
      listingError={form.listingError}
      goDisabled={form.goDisabled}
      useCookies={form.useCookies}
      cookiesText={form.cookiesText}
      useCookiesFromBrowser={form.useCookiesFromBrowser}
      cookiesBrowser={form.cookiesBrowser}
      start1080pBlocked={form.start1080pBlocked}
      platform={form.platform}
      onUseCookiesChange={form.setUseCookies}
      onUseCookiesFromBrowserChange={form.setUseCookiesFromBrowser}
      onCookiesBrowserChange={form.setCookiesBrowser}
      onOpenCookiesEditor={form.handleOpenCookiesEditor}
      isUrlValid={form.isUrlValid}
      selectedFormatPresetId={form.selectedFormatPresetId}
      is1080pAvailable={form.is1080pAvailable}
      onFormatChange={form.setSelectedFormatPresetId}
      showCookiesAtTopLevel={form.showCookiesAtTopLevel}
      formatMode={form.formatMode}
      formatCodes={form.formatCodes}
      selectedFormatCode={form.selectedFormatCode}
      selectedSupplementaryFormatCode={form.selectedSupplementaryFormatCode}
      hideFormatCodeUi={hideFormatCodeUi}
      onFormatModeChange={form.setFormatMode}
      onFormatCodeChange={form.setSelectedFormatCode}
      onSupplementaryFormatCodeChange={form.setSelectedSupplementaryFormatCode}
      isYoutube={form.isYoutube}
      useJsRuntime={form.useJsRuntime}
      jsRuntime={form.jsRuntime}
      onUseJsRuntimeChange={form.setUseJsRuntime}
      onJsRuntimeChange={form.setJsRuntime}
      quickjsUnavailable={form.quickjsUnavailable}
      canDownloadEpisodes={form.canDownloadEpisodes}
      downloadEpisodes={flow.downloadEpisodes}
      episodes={flow.episodes}
      episodesLoading={flow.episodesLoading}
      episodesError={flow.episodesError}
      selectedEpisodeUrls={flow.selectedEpisodeUrls}
      onDownloadEpisodesChange={flow.handleDownloadEpisodesChange}
      onToggleEpisode={flow.toggleEpisodeSelection}
      isCollectionUrl={form.isCollectionUrl}
      downloadCollectionVideos={flow.downloadCollectionVideos}
      collectionEntries={flow.collectionEntries}
      collectionMetadataLoading={flow.collectionMetadataLoading}
      collectionError={flow.collectionError}
      selectedCollectionUrls={flow.selectedCollectionUrls}
      onDownloadCollectionVideosChange={flow.handleDownloadCollectionVideosChange}
      onToggleCollectionUrl={flow.toggleCollectionUrlSelection}
      showMoreOptions={form.showMoreOptions}
      extraArgSelection={form.extraArgSelection}
      onShowMoreOptionsChange={form.setShowMoreOptions}
      onExtraArgToggle={form.setExtraArgEnabled}
      downloadFolder={form.downloadFolder}
      onFolderChange={form.setDownloadFolder}
      onFolderSelect={handleFolderSelect}
      collectionEntriesLength={flow.collectionEntries.length}
      isEnqueueing={flow.isEnqueueing}
      startButtonDisabled={startButtonDisabled}
      onCancel={handleCancel}
      onStart={flow.handleStart}
      onClose={handleCancel}
      t={td}
      tCommon={tdCommon}
    />
  )
}

export function DownloadVideoDialog(props: DownloadVideoDialogProps) {
  if (!props.isOpen) return null
  return <DownloadVideoDialogContent {...props} />
}
