import { useCallback } from "react"
import type { DownloadVideoDialogProps, FileItem } from "../types"
import { useTranslation } from "@/lib/i18n"
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

  // i18next TFunction overloads are not directly assignable to (key: string) => string
  const td = t as unknown as (key: string) => string
  const tdCommon = tCommon as unknown as (key: string) => string

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
    onClose,
    t: td,
  })

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
      onUrlBlur={form.handleUrlBlur}
      useCookies={form.useCookies}
      useCookiesFromBrowser={form.useCookiesFromBrowser}
      cookiesBrowser={form.cookiesBrowser}
      start1080pBlocked={form.start1080pBlocked}
      onUseCookiesChange={form.setUseCookies}
      onUseCookiesFromBrowserChange={form.setUseCookiesFromBrowser}
      onCookiesBrowserChange={form.setCookiesBrowser}
      onOpenCookiesEditor={form.handleOpenCookiesEditor}
      isUrlValid={form.isUrlValid}
      selectedFormatPresetId={form.selectedFormatPresetId}
      is1080pAvailable={form.is1080pAvailable}
      onFormatChange={form.setSelectedFormatPresetId}
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
      selectedCollectionUrlsSize={flow.selectedCollectionUrls.size}
      isEnqueueing={flow.isEnqueueing}
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
