import { useState, useCallback, useEffect, useRef } from "react"
import { FolderOpen } from "lucide-react"
import { Dialog, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import {
  ScrollableDialogBody,
  ScrollableDialogContent,
  ScrollableDialogFooter,
  ScrollableDialogHeader,
} from "@/components/ui/scrollable-dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import type { DownloadVideoDialogProps, FileItem } from "./types"
import { useTranslation } from "@/lib/i18n"
import type { YtdlpVideo } from "@core/types/YtdlpTypes"
import { toast } from "sonner"
import { validateDownloadUrl } from "@core/download-video-validators"
import { isBilibiliCollectionUrl } from "@/api/ytdlp"
import {
  useBilibiliCollectionMetadataMutation,
  useBilibiliEpisodesMetadataMutation,
  useExtractYtdlpVideoDataMutation,
} from "@/hooks/ytdlp/useYtdlpMutations"
import { buildDownloadVideoJob } from "@/lib/downloadVideoJobFactory"
import { saveDownloadVideoJob } from "@/lib/downloadTaskDb"
import { ListItem } from "@/components/dialogs/download-video-list-item"

const LOCAL_STORAGE_KEY = "DownloadVideoDialog.userAgreed"

interface EpisodeItem {
  title: string
  artist: string
  /** Stable id for selection; same as the download URL. */
  url: string
}

function isBilibiliUrl(value: string): boolean {
  const trimmed = value.trim()
  if (!trimmed) return false
  try {
    const parsed = new URL(trimmed)
    const host = parsed.hostname.toLowerCase()
    return host === "b23.tv" || host.endsWith(".bilibili.com") || host === "bilibili.com"
  } catch {
    return false
  }
}

function ytdlpVideosToEpisodeItems(videos: YtdlpVideo[]): EpisodeItem[] {
  return videos
    .map((v) => {
      const url = v.webpage_url?.trim() || v.original_url?.trim() || ""
      if (!url) {
        return null
      }
      return {
        title: (v.fulltitle || v.title || v.id) as string,
        url,
        artist: v.uploader || v.uploader_id || "",
      }
    })
    .filter((item): item is EpisodeItem => item !== null)
}

export function DownloadVideoDialog({ isOpen, onClose, onOpenFilePicker, destinationFolder }: DownloadVideoDialogProps) {
  const { t } = useTranslation('dialogs')
  const { t: tCommon } = useTranslation('common')
  const [url, setUrl] = useState("")
  const [downloadFolder, setDownloadFolder] = useState("")
  const [urlError, setUrlError] = useState<string | null>(null)
  const [urlTouched, setUrlTouched] = useState(false)
  const [hasAgreed, setHasAgreed] = useState(false)
  const [isAgreementChecked, setIsAgreementChecked] = useState(false)
  const [downloadEpisodes, setDownloadEpisodes] = useState(false)
  const [downloadCollectionVideos, setDownloadCollectionVideos] = useState(false)
  const [episodes, setEpisodes] = useState<EpisodeItem[]>([])
  const [episodesLoading, setEpisodesLoading] = useState(false)
  const [episodesError, setEpisodesError] = useState<string | null>(null)
  const [selectedEpisodeUrls, setSelectedEpisodeUrls] = useState<Set<string>>(new Set())
  const [isEnqueueing, setIsEnqueueing] = useState(false)
  const [collectionEntries, setCollectionEntries] = useState<
    { url: string }[]
  >([])
  const [selectedCollectionUrls, setSelectedCollectionUrls] = useState<
    Set<string>
  >(new Set())
  const [collectionError, setCollectionError] = useState<string | null>(null)
  const episodesFetchGen = useRef(0)
  const previousUrlRef = useRef("")

  const { mutate: mutateEpisodesMetadata, reset: resetEpisodesMetadata } =
    useBilibiliEpisodesMetadataMutation()
  const {
    mutate: mutateCollectionMetadata,
    reset: resetCollectionMetadata,
    isPending: collectionMetadataLoading,
  } = useBilibiliCollectionMetadataMutation()
  const extractMutation = useExtractYtdlpVideoDataMutation()

  const isUrlValid = url.trim() !== "" && validateDownloadUrl(url.trim()).valid
  const isCollectionUrl =
    isBilibiliCollectionUrl(url.trim()) && isUrlValid

  const formBusy =
    isEnqueueing ||
    (downloadEpisodes && episodesLoading) ||
    (downloadCollectionVideos && collectionMetadataLoading)
  const canDownloadEpisodes = isBilibiliUrl(url) && !isCollectionUrl

  const resetEpisodesState = useCallback(() => {
    episodesFetchGen.current += 1
    setDownloadEpisodes(false)
    setEpisodes([])
    setSelectedEpisodeUrls(new Set())
    setEpisodesError(null)
    setEpisodesLoading(false)
    resetEpisodesMetadata()
  }, [resetEpisodesMetadata])

  useEffect(() => {
    if (isOpen && destinationFolder) {
      setDownloadFolder(destinationFolder)
    }
  }, [isOpen, destinationFolder])

  useEffect(() => {
    if (!isOpen) {
      return
    }
    if (typeof window === "undefined") {
      return
    }
    const stored = window.localStorage.getItem(LOCAL_STORAGE_KEY)
    if (stored === "true") {
      setHasAgreed(true)
      setIsAgreementChecked(true)
    } else {
      setHasAgreed(false)
      setIsAgreementChecked(false)
    }
  }, [isOpen])

  const fetchEpisodesMetadata = useCallback(() => {
    if (!isOpen || !hasAgreed) {
      return
    }
    const trimmed = url.trim()
    if (!trimmed || !validateDownloadUrl(trimmed).valid) {
      setEpisodes([])
      setSelectedEpisodeUrls(new Set())
      setEpisodesError(null)
      setEpisodesLoading(false)
      resetEpisodesMetadata()
      return
    }

    const gen = ++episodesFetchGen.current
    setEpisodesLoading(true)
    setEpisodesError(null)

    mutateEpisodesMetadata(trimmed, {
      onSuccess: (result) => {
        if (gen !== episodesFetchGen.current) {
          return
        }
        if (result.error) {
          setEpisodesError(result.error)
          setEpisodes([])
          setSelectedEpisodeUrls(new Set())
        } else {
          const items = ytdlpVideosToEpisodeItems(result.videos ?? [])
          setEpisodes(items)
          setSelectedEpisodeUrls(new Set(items.map((v) => v.url)))
          setEpisodesError(null)
        }
      },
      onSettled: () => {
        if (gen === episodesFetchGen.current) {
          setEpisodesLoading(false)
        }
      },
    })
  }, [isOpen, hasAgreed, url, mutateEpisodesMetadata, resetEpisodesMetadata])

  const runUrlValidation = useCallback((value: string) => {
    const result = validateDownloadUrl(value)
    if (!result.valid) {
      setUrlError(t(`downloadVideo.validation.${result.error}` as 'downloadVideo.validation.URL_EMPTY'))
    } else {
      setUrlError(null)
    }
  }, [t])

  const resetCollectionState = useCallback(() => {
    setDownloadCollectionVideos(false)
    setCollectionEntries([])
    setSelectedCollectionUrls(new Set())
    setCollectionError(null)
    resetCollectionMetadata()
  }, [resetCollectionMetadata])

  useEffect(() => {
    const current = url.trim()
    const previous = previousUrlRef.current
    if (previous && previous !== current && downloadEpisodes) {
      resetEpisodesState()
    }
    if (previous && previous !== current) {
      resetCollectionState()
    }
    previousUrlRef.current = current
  }, [url, downloadEpisodes, resetEpisodesState, resetCollectionState])

  useEffect(() => {
    if (canDownloadEpisodes) return
    const hasEpisodesStateToReset =
      downloadEpisodes ||
      episodes.length > 0 ||
      selectedEpisodeUrls.size > 0 ||
      episodesError !== null ||
      episodesLoading
    if (!hasEpisodesStateToReset) return
    resetEpisodesState()
  }, [
    canDownloadEpisodes,
    downloadEpisodes,
    episodes.length,
    selectedEpisodeUrls.size,
    episodesError,
    episodesLoading,
    resetEpisodesState,
  ])

  const handleUrlChange = (value: string) => {
    setUrl(value)
    if (urlTouched) {
      runUrlValidation(value)
    }
  }

  const handleUrlBlur = () => {
    setUrlTouched(true)
    runUrlValidation(url)
  }

  const handleAgreementChange = (checked: boolean) => {
    setIsAgreementChecked(checked)
    if (!checked) {
      return
    }
    if (typeof window !== "undefined") {
      window.localStorage.setItem(LOCAL_STORAGE_KEY, "true")
    }
    setHasAgreed(true)
  }

  const fetchCollectionMetadata = useCallback(() => {
    if (!hasAgreed || !isCollectionUrl) {
      return
    }
    const trimmed = url.trim()
    setCollectionError(null)
    mutateCollectionMetadata(trimmed, {
      onSuccess: (metadata) => {
        setCollectionEntries(metadata.entries)
        setSelectedCollectionUrls(
          new Set(metadata.entries.map((e) => e.url.trim()).filter(Boolean))
        )
      },
      onError: (err) => {
        const message = err instanceof Error ? err.message : String(err)
        setCollectionError(message)
        setCollectionEntries([])
        setSelectedCollectionUrls(new Set())
        toast.error(message)
      },
    })
  }, [hasAgreed, isCollectionUrl, url, mutateCollectionMetadata])

  const handleDownloadCollectionVideosChange = (checked: boolean) => {
    if (!checked) {
      resetCollectionState()
      return
    }
    setDownloadCollectionVideos(true)
    fetchCollectionMetadata()
  }

  const handleStart = async () => {
    if (!hasAgreed) {
      return
    }
    const validation = validateDownloadUrl(url.trim())
    if (!validation.valid) {
      setUrlError(t(`downloadVideo.validation.${validation.error}` as 'downloadVideo.validation.URL_EMPTY'))
      return
    }

    if (!downloadFolder.trim()) {
      return
    }

    if (isCollectionUrl) {
      if (selectedCollectionUrls.size === 0) {
        toast.error(t("downloadVideo.episodesNoneSelected"))
        return
      }

      setIsEnqueueing(true)
      try {
        for (const u of selectedCollectionUrls) {
          const job = buildDownloadVideoJob({
            name: "Download Video",
            folder: downloadFolder,
            urls: [u],
            itemMeta: [{ title: u, artist: "" }],
          })
          void saveDownloadVideoJob(job)
        }
        onClose()
      } catch (error) {
        console.error("[DownloadVideoDialog] Failed to enqueue download job:", error)
        toast.error(error instanceof Error ? error.message : "Download failed")
      } finally {
        setIsEnqueueing(false)
      }
      return
    }

    setIsEnqueueing(true)
    try {

      let urls: string[] = []

      if (downloadEpisodes) {

        if (selectedEpisodeUrls.size === 0) {
          console.warn('[DownloadVideoDialog] No episodes selected for multi-episode download')
          return
        }

        urls = Array.from(selectedEpisodeUrls)

      } else {

        urls = [url.trim()]

      }

      const jobs = urls.map((u) => {
        const episode = episodes.find((e) => e.url === u)
        return buildDownloadVideoJob({
          name: episode?.title || 'Download Video',
          folder: downloadFolder,
          urls: [u],
          itemMeta: episode ? [{ title: episode.title, artist: episode.artist }] : undefined,
        })
      })

      for (const job of jobs) {
        void saveDownloadVideoJob(job)
      }

      onClose()
    } catch (error) {
      console.error('[DownloadVideoDialog] Failed to enqueue download job:', error)
      toast.error(error instanceof Error ? error.message : 'Download failed')
    } finally {
      setIsEnqueueing(false)
    }
  }

  const handleCancel = () => {
    episodesFetchGen.current += 1
    setUrl("")
    setDownloadFolder("")
    setUrlError(null)
    setUrlTouched(false)
    setDownloadEpisodes(false)
    setEpisodes([])
    setEpisodesLoading(false)
    setEpisodesError(null)
    setSelectedEpisodeUrls(new Set())
    setIsEnqueueing(false)
    resetEpisodesMetadata()
    resetCollectionState()
    extractMutation.reset()
    onClose()
  }

  const toggleEpisodeSelection = (id: string) => {
    setSelectedEpisodeUrls((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const toggleCollectionUrlSelection = (id: string) => {
    setSelectedCollectionUrls((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const handleDownloadEpisodesChange = (checked: boolean) => {
    if (!checked) {
      resetEpisodesState()
      return
    }
    setDownloadEpisodes(true)
    fetchEpisodesMetadata()
  }

  const handleFolderSelect = () => {
    onOpenFilePicker(
      (file: FileItem) => {
        setDownloadFolder(file.path)
      },
      { selectFolder: true, initialPath: downloadFolder || undefined }
    )
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleCancel()}>
      <ScrollableDialogContent
        data-testid="download-video-dialog"
        showCloseButton={true}
        className="max-w-2xl overflow-hidden"
      >
        <ScrollableDialogHeader>
          <DialogTitle>{t('downloadVideo.title')}</DialogTitle>
          <DialogDescription>
            {t('downloadVideo.description')}
          </DialogDescription>
        </ScrollableDialogHeader>
        <ScrollableDialogBody>
          <div className="flex flex-col gap-4 px-1 py-2 pr-4">
          {!hasAgreed && (
            <div className="flex flex-col gap-2 rounded-md border border-border bg-muted/40 p-3 text-sm">
              <p className="font-medium">
                {t('downloadVideo.agreementTitle')}
              </p>
              <p className="text-muted-foreground">
                {t('downloadVideo.agreementDescription')}
              </p>
              <label className="mt-1 inline-flex items-center gap-2 text-sm">
                <input
                  data-testid="download-video-dialog-agreement-checkbox"
                  type="checkbox"
                  className="h-3.5 w-3.5"
                  checked={isAgreementChecked}
                  onChange={(e) => handleAgreementChange(e.target.checked)}
                />
                <span>{t('downloadVideo.agreementCheckboxLabel')}</span>
              </label>
              {!isAgreementChecked && (
                <p className="text-xs text-destructive">
                  {t('downloadVideo.agreementRequiredNotice')}
                </p>
              )}
            </div>
          )}
          <div className="flex flex-col gap-2">
            <Label htmlFor="url">{t('downloadVideo.urlLabel')}</Label>
            <Input
              data-testid="download-video-dialog-url-input"
              id="url"
              type="url"
              placeholder="https://www.youtube.com/watch?v=..."
              value={url}
              onChange={(e) => handleUrlChange(e.target.value)}
              onBlur={handleUrlBlur}
              disabled={formBusy || !hasAgreed}
              className={urlError ? "border-destructive" : ""}
            />
            {urlError && (
              <p className="text-sm text-destructive">{urlError}</p>
            )}
          </div>
          {canDownloadEpisodes && (
            <label className="inline-flex items-center gap-2 text-sm">
              <input
                data-testid="download-video-dialog-episodes-checkbox"
                type="checkbox"
                className="h-3.5 w-3.5"
                checked={downloadEpisodes}
                onChange={(e) => handleDownloadEpisodesChange(e.target.checked)}
                disabled={formBusy || !hasAgreed}
              />
              <span>{t('downloadVideo.downloadEpisodesLabel')}</span>
            </label>
          )}
          {isCollectionUrl && (
            <label className="inline-flex items-center gap-2 text-sm">
              <input
                data-testid="download-video-dialog-get-videos-checkbox"
                type="checkbox"
                className="h-3.5 w-3.5"
                checked={downloadCollectionVideos}
                onChange={(e) =>
                  handleDownloadCollectionVideosChange(e.target.checked)
                }
                disabled={formBusy || !hasAgreed}
              />
              <span>{t("downloadVideo.getVideos")}</span>
            </label>
          )}
          {downloadEpisodes && hasAgreed && (
            <div data-testid="download-video-dialog-episodes-panel" className="flex flex-col gap-2 rounded-md border border-border bg-muted/30 p-3">
              {episodesLoading && (
                <p className="text-sm text-muted-foreground">{t('downloadVideo.episodesLoading')}</p>
              )}
              {episodesError && !episodesLoading && (
                <p className="text-sm text-destructive">{episodesError}</p>
              )}
              {!episodesLoading && !episodesError && episodes.length > 0 && (
                <ScrollArea className="h-52">
                  <ul data-testid="download-video-dialog-episodes-list" className="list-none space-y-2 p-0 m-0 pr-3">
                    {episodes.map((episode) => {
                      const { title, url: vidUrl } = episode
                      return (
                        <ListItem
                          key={vidUrl}
                          listItemTestId="download-video-dialog-episodes-list-item"
                          checkboxTestId={`download-video-dialog-episode-checkbox-${episode.url}`}
                          label={title}
                          checked={selectedEpisodeUrls.has(vidUrl)}
                          onToggle={() => {
                            toggleEpisodeSelection(vidUrl)
                          }}
                          disabled={formBusy}
                        />
                      )
                    })}
                  </ul>
                </ScrollArea>
              )}
            </div>
          )}
          {downloadCollectionVideos && isCollectionUrl && hasAgreed && (
            <div
              data-testid="download-video-dialog-collection-panel"
              className="flex flex-col gap-2 rounded-md border border-border bg-muted/30 p-3"
            >
              {collectionMetadataLoading && (
                <p className="text-sm text-muted-foreground">
                  {t("downloadVideo.collectionVideosLoading")}
                </p>
              )}
              {collectionError && !collectionMetadataLoading && (
                <p className="text-sm text-destructive">{collectionError}</p>
              )}
              {!collectionMetadataLoading && !collectionError && collectionEntries.length > 0 && (
                <ScrollArea className="h-52">
                  <ul
                    data-testid="download-video-dialog-collection-list"
                    className="list-none space-y-2 p-0 m-0 pr-3"
                  >
                    {collectionEntries.map((entry) => {
                      const vidUrl = entry.url
                      return (
                        <ListItem
                          key={vidUrl}
                          listItemTestId="download-video-dialog-collection-list-item"
                          checkboxTestId={`download-video-dialog-collection-checkbox-${vidUrl}`}
                          label={vidUrl}
                          labelClassName="break-all leading-snug"
                          fetchVideoMetadata
                          videoUrl={vidUrl}
                          checked={selectedCollectionUrls.has(vidUrl)}
                          onToggle={() => {
                            toggleCollectionUrlSelection(vidUrl)
                          }}
                          disabled={formBusy}
                        />
                      )
                    })}
                  </ul>
                </ScrollArea>
              )}
            </div>
          )}
          <div className="flex flex-col gap-2">
            <Label htmlFor="downloadFolder">{t('downloadVideo.folderLabel')}</Label>
            <div className="flex gap-2">
              <Input
                data-testid="download-video-dialog-folder-input"
                id="downloadFolder"
                type="text"
                placeholder={t('downloadVideo.folderPlaceholder')}
                value={downloadFolder}
                onChange={(e) => setDownloadFolder(e.target.value)}
                disabled={formBusy || !hasAgreed}
                readOnly
              />
              <Button
                data-testid="download-video-dialog-folder-picker"
                type="button"
                variant="outline"
                onClick={handleFolderSelect}
                disabled={formBusy || !hasAgreed}
              >
                <FolderOpen className="h-4 w-4" />
              </Button>
            </div>
          </div>
          </div>
        </ScrollableDialogBody>
        <ScrollableDialogFooter>
          <Button data-testid="download-video-dialog-cancel" variant="outline" onClick={handleCancel} disabled={formBusy}>
            {tCommon('cancel')}
          </Button>
          {isCollectionUrl ? (
            collectionEntries.length > 0 && (
              <Button
                data-testid="download-video-dialog-start"
                onClick={() => void handleStart()}
                disabled={
                  !isUrlValid ||
                  !downloadFolder.trim() ||
                  formBusy ||
                  !hasAgreed ||
                  selectedCollectionUrls.size === 0
                }
              >
                {isEnqueueing ? t("downloadVideo.downloading") : t("downloadVideo.start")}
              </Button>
            )
          ) : (
            <Button
              data-testid="download-video-dialog-start"
              onClick={() => void handleStart()}
              disabled={!isUrlValid || !downloadFolder.trim() || formBusy || !hasAgreed}
            >
              {isEnqueueing ? t('downloadVideo.downloading') : t("downloadVideo.start")}
            </Button>
          )}
        </ScrollableDialogFooter>
      </ScrollableDialogContent>
    </Dialog>
  )
}
