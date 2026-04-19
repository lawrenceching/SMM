import { useState, useCallback, useEffect, useRef } from "react"
import { FolderOpen } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { DownloadVideoDialogProps, FileItem } from "./types"
import { useTranslation } from "@/lib/i18n"
import type { YtdlpVideo } from "@core/types/YtdlpTypes"
import { toast } from "sonner"
import { validateDownloadUrl } from "@core/download-video-validators"
import {
  useBilibiliEpisodesMetadataMutation,
  useExtractYtdlpVideoDataMutation,
} from "@/hooks/ytdlp/useYtdlpMutations"
import { buildDownloadVideoJob } from "@/lib/downloadVideoJobFactory"
import { saveDownloadVideoJob } from "@/lib/downloadTaskDb"

const LOCAL_STORAGE_KEY = "DownloadVideoDialog.userAgreed"

interface EpisodeItem {
  title: string
  artist: string
  /** Stable id for selection; same as the download URL. */
  url: string
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
  const [episodes, setEpisodes] = useState<EpisodeItem[]>([])
  const [episodesLoading, setEpisodesLoading] = useState(false)
  const [episodesError, setEpisodesError] = useState<string | null>(null)
  const [selectedEpisodeUrls, setSelectedEpisodeUrls] = useState<Set<string>>(new Set())
  const [isEnqueueing, setIsEnqueueing] = useState(false)
  const episodesFetchGen = useRef(0)

  const { mutate: mutateEpisodesMetadata, reset: resetEpisodesMetadata } =
    useBilibiliEpisodesMetadataMutation()
  const extractMutation = useExtractYtdlpVideoDataMutation()

  const formBusy = isEnqueueing || (downloadEpisodes && episodesLoading)

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

  const isUrlValid = url.trim() !== "" && validateDownloadUrl(url.trim()).valid

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

  const handleDownloadEpisodesChange = (checked: boolean) => {
    if (!checked) {
      episodesFetchGen.current += 1
      setEpisodes([])
      setSelectedEpisodeUrls(new Set())
      setEpisodesError(null)
      setEpisodesLoading(false)
      resetEpisodesMetadata()
      setDownloadEpisodes(false)
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
      <DialogContent showCloseButton={true} className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t('downloadVideo.title')}</DialogTitle>
          <DialogDescription>
            {t('downloadVideo.description')}
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4 py-4">
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
          <label className="inline-flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="h-3.5 w-3.5"
              checked={downloadEpisodes}
              onChange={(e) => handleDownloadEpisodesChange(e.target.checked)}
              disabled={formBusy || !hasAgreed}
            />
            <span>{t('downloadVideo.downloadEpisodesLabel')}</span>
          </label>
          {downloadEpisodes && hasAgreed && (
            <div className="flex flex-col gap-2 rounded-md border border-border bg-muted/30 p-3">
              {episodesLoading && (
                <p className="text-sm text-muted-foreground">{t('downloadVideo.episodesLoading')}</p>
              )}
              {episodesError && !episodesLoading && (
                <p className="text-sm text-destructive">{episodesError}</p>
              )}
              {!episodesLoading && !episodesError && episodes.length > 0 && (
                <ul className="max-h-52 list-none space-y-2 overflow-y-auto p-0 m-0">
                  {episodes.map((episode) => {
                    const { title, url: vidUrl } = episode
                    return (
                      <li key={vidUrl}>
                        <label className="flex cursor-pointer items-start gap-2 text-sm">
                          <input
                            type="checkbox"
                            className="mt-0.5 h-3.5 w-3.5 shrink-0"
                            checked={selectedEpisodeUrls.has(vidUrl)}
                            onChange={() => toggleEpisodeSelection(vidUrl)}
                            disabled={formBusy}
                          />
                          <span className="leading-snug">{title}</span>
                        </label>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          )}
          <div className="flex flex-col gap-2">
            <Label htmlFor="downloadFolder">{t('downloadVideo.folderLabel')}</Label>
            <div className="flex gap-2">
              <Input
                id="downloadFolder"
                type="text"
                placeholder={t('downloadVideo.folderPlaceholder')}
                value={downloadFolder}
                onChange={(e) => setDownloadFolder(e.target.value)}
                disabled={formBusy || !hasAgreed}
                readOnly
              />
              <Button
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
        <div className="flex justify-end gap-2 pt-4">
          <Button variant="outline" onClick={handleCancel} disabled={formBusy}>
            {tCommon('cancel')}
          </Button>
          <Button
            onClick={() => void handleStart()}
            disabled={!isUrlValid || !downloadFolder.trim() || formBusy || !hasAgreed}
          >
            {isEnqueueing ? t('downloadVideo.downloading') : t('downloadVideo.start')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
