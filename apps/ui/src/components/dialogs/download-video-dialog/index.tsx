import { useCallback } from "react"
import { Dialog, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import {
  ScrollableDialogBody,
  ScrollableDialogContent,
  ScrollableDialogFooter,
  ScrollableDialogHeader,
} from "@/components/ui/scrollable-dialog"
import type { DownloadVideoDialogProps, FileItem } from "../types"
import { useTranslation } from "@/lib/i18n"
import { useDownloadVideoForm } from "../hooks/use-download-video-form"
import { useYtdlpDownloadFlow } from "../hooks/use-ytdlp-download-flow"
import { AgreementSection } from "./components/agreement-section"
import { UrlInputSection } from "./components/url-input-section"
import { CookiesSection } from "./components/cookies-section"
import { FormatSection } from "./components/format-section"
import { EpisodesSection } from "./components/episodes-section"
import { CollectionSection } from "./components/collection-section"
import { MoreOptionsSection } from "./components/more-options-section"
import { FolderSection } from "./components/folder-section"
import { DialogFooter } from "./components/dialog-footer"

export function DownloadVideoDialog({
  isOpen,
  onClose,
  onOpenFilePicker,
  destinationFolder,
}: DownloadVideoDialogProps) {
  const { t } = useTranslation("dialogs")
  const { t: tCommon } = useTranslation("common")

  // i18next TFunction overloads are not directly assignable to (key: string) => string
  const td = t as unknown as (key: string) => string
  const tdCommon = tCommon as unknown as (key: string) => string

  const form = useDownloadVideoForm({ isOpen, destinationFolder, t: td })

  const flow = useYtdlpDownloadFlow({
    isOpen,
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
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleCancel()}>
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
              hasAgreed={form.hasAgreed}
              isAgreementChecked={form.isAgreementChecked}
              onAgreementChange={form.handleAgreementChange}
              t={td}
            />

            <UrlInputSection
              url={form.url}
              urlError={form.urlError}
              formBusy={flow.formBusy}
              disabled={!form.hasAgreed}
              onUrlChange={form.handleUrlChange}
              onUrlBlur={form.handleUrlBlur}
              t={td}
            />

            {form.hasAgreed && (
              <CookiesSection
                useCookies={form.useCookies}
                useCookiesFromBrowser={form.useCookiesFromBrowser}
                cookiesBrowser={form.cookiesBrowser}
                start1080pBlocked={form.start1080pBlocked}
                formBusy={flow.formBusy}
                onUseCookiesChange={form.setUseCookies}
                onUseCookiesFromBrowserChange={form.setUseCookiesFromBrowser}
                onCookiesBrowserChange={form.setCookiesBrowser}
                onOpenCookiesEditor={form.handleOpenCookiesEditor}
                t={td}
              />
            )}

            {form.hasAgreed && (
              <FormatSection
                isUrlValid={form.isUrlValid}
                selectedFormatPresetId={form.selectedFormatPresetId}
                is1080pAvailable={form.is1080pAvailable}
                formBusy={flow.formBusy}
                onFormatChange={form.setSelectedFormatPresetId}
                t={td}
              />
            )}

            <EpisodesSection
              canDownloadEpisodes={form.canDownloadEpisodes}
              downloadEpisodes={flow.downloadEpisodes}
              episodes={flow.episodes}
              episodesLoading={flow.episodesLoading}
              episodesError={flow.episodesError}
              selectedEpisodeUrls={flow.selectedEpisodeUrls}
              formBusy={flow.formBusy}
              hasAgreed={form.hasAgreed}
              onDownloadEpisodesChange={flow.handleDownloadEpisodesChange}
              onToggleEpisode={flow.toggleEpisodeSelection}
              t={td}
            />

            {form.hasAgreed && form.isUrlValid && (
              <MoreOptionsSection
                showMoreOptions={form.showMoreOptions}
                extraArgSelection={form.extraArgSelection}
                formBusy={flow.formBusy}
                onShowMoreOptionsChange={form.setShowMoreOptions}
                onExtraArgToggle={form.setExtraArgEnabled}
                t={td}
              />
            )}

            <CollectionSection
              isCollectionUrl={form.isCollectionUrl}
              downloadCollectionVideos={flow.downloadCollectionVideos}
              collectionEntries={flow.collectionEntries}
              collectionMetadataLoading={flow.collectionMetadataLoading}
              collectionError={flow.collectionError}
              selectedCollectionUrls={flow.selectedCollectionUrls}
              formBusy={flow.formBusy}
              hasAgreed={form.hasAgreed}
              onDownloadCollectionVideosChange={flow.handleDownloadCollectionVideosChange}
              onToggleCollectionUrl={flow.toggleCollectionUrlSelection}
              t={td}
            />

            <FolderSection
              downloadFolder={form.downloadFolder}
              formBusy={flow.formBusy}
              disabled={!form.hasAgreed}
              onFolderChange={form.setDownloadFolder}
              onFolderSelect={handleFolderSelect}
              t={td}
            />
          </div>
        </ScrollableDialogBody>
        <ScrollableDialogFooter>
          <DialogFooter
            hasAgreed={form.hasAgreed}
            isUrlValid={form.isUrlValid}
            downloadFolder={form.downloadFolder}
            formBusy={flow.formBusy}
            start1080pBlocked={form.start1080pBlocked}
            isCollectionUrl={form.isCollectionUrl}
            collectionEntriesLength={flow.collectionEntries.length}
            selectedCollectionUrlsSize={flow.selectedCollectionUrls.size}
            isEnqueueing={flow.isEnqueueing}
            onCancel={handleCancel}
            onStart={flow.handleStart}
            t={td}
            tCommon={tdCommon}
          />
        </ScrollableDialogFooter>
      </ScrollableDialogContent>
    </Dialog>
  )
}
