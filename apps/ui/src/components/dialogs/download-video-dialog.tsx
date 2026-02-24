import { useState, useCallback, useEffect } from "react"
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
import { Progress } from "@/components/ui/progress"
import type { DownloadVideoDialogProps, FileItem } from "./types"
import { useTranslation } from "@/lib/i18n"
import { downloadYtdlpVideo, extractYtdlpVideoData } from "@/api/ytdlp"
import { toast } from "sonner"
import { validateDownloadUrl } from "@core/download-video-validators"

export function DownloadVideoDialog({ isOpen, onClose, onStart, onOpenFilePicker, destinationFolder, onVideoDataExtracted, onDownloadComplete }: DownloadVideoDialogProps) {
  const { t } = useTranslation(['dialogs', 'common'])
  const [url, setUrl] = useState("")
  const [downloadFolder, setDownloadFolder] = useState("")
  const [progress, setProgress] = useState(0)
  const [isDownloading, setIsDownloading] = useState(false)
  const [urlError, setUrlError] = useState<string | null>(null)
  const [urlTouched, setUrlTouched] = useState(false)

  useEffect(() => {
    if (isOpen && destinationFolder) {
      setDownloadFolder(destinationFolder)
    }
  }, [isOpen, destinationFolder])

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

  const handleStart = async () => {
    const validation = validateDownloadUrl(url.trim())
    if (!validation.valid) {
      setUrlError(t(`downloadVideo.validation.${validation.error}` as 'downloadVideo.validation.URL_EMPTY'))
      return
    }

    if (downloadFolder.trim()) {
      const currentUrl = url.trim()
      const currentFolder = downloadFolder.trim()

      setIsDownloading(true)
      setProgress(0)

      if (onVideoDataExtracted) {
        try {
          const result = await extractYtdlpVideoData(currentUrl)
          if (result.title || result.artist) {
            onVideoDataExtracted({
              title: result.title,
              artist: result.artist,
            }, currentUrl)
          }
        } catch (error) {
          console.error('[DownloadVideoDialog] Failed to extract video data:', error)
        }
      }

      onStart(currentUrl, currentFolder)

      if (destinationFolder) {
        downloadYtdlpVideo({
          url: currentUrl,
          folder: currentFolder,
          args: ["--write-thumbnail", "--embed-thumbnail"],
        }).then((result) => {
          if (result.error) {
            toast.error(result.error)
          } else if (result.success) {
            onDownloadComplete?.(currentUrl, result.path || '')
          }
        })
        setIsDownloading(false)
        onClose()
        return
      }

      const result = await downloadYtdlpVideo({
        url: currentUrl,
        folder: currentFolder,
        args: ["--write-thumbnail", "--embed-thumbnail"],
      })

      setIsDownloading(false)
      setProgress(100)

      if (result.error) {
        toast.error(result.error)
      } else if (result.success) {
        toast.success(`Downloaded to: ${result.path}`)
        onDownloadComplete?.(currentUrl, result.path || '')
        onClose()
      }
    }
  }

  const handleCancel = () => {
    setUrl("")
    setDownloadFolder("")
    setProgress(0)
    setIsDownloading(false)
    setUrlError(null)
    setUrlTouched(false)
    onClose()
  }

  const handleFolderSelect = () => {
    onOpenFilePicker((file: FileItem) => {
      setDownloadFolder(file.path)
    })
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
          <div className="flex flex-col gap-2">
            <Label htmlFor="url">{t('downloadVideo.urlLabel')}</Label>
            <Input
              id="url"
              type="url"
              placeholder="https://www.youtube.com/watch?v=..."
              value={url}
              onChange={(e) => handleUrlChange(e.target.value)}
              onBlur={handleUrlBlur}
              disabled={isDownloading}
              className={urlError ? "border-destructive" : ""}
            />
            {urlError && (
              <p className="text-sm text-destructive">{urlError}</p>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="downloadFolder">{t('downloadVideo.folderLabel')}</Label>
            <div className="flex gap-2">
              <Input
                id="downloadFolder"
                type="text"
                placeholder={t('downloadVideo.folderPlaceholder')}
                value={downloadFolder}
                onChange={(e) => setDownloadFolder(e.target.value)}
                disabled={isDownloading}
                readOnly
              />
              <Button
                type="button"
                variant="outline"
                onClick={handleFolderSelect}
                disabled={isDownloading}
              >
                <FolderOpen className="h-4 w-4" />
              </Button>
            </div>
          </div>
          {isDownloading && (
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{t('downloadVideo.downloading')}</span>
                <span className="text-muted-foreground">{progress}%</span>
              </div>
              <Progress value={progress} />
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2 pt-4">
          <Button variant="outline" onClick={handleCancel} disabled={isDownloading}>
            {t('cancel', { ns: 'common' })}
          </Button>
          <Button onClick={handleStart} disabled={!isUrlValid || !downloadFolder.trim() || isDownloading}>
            {isDownloading ? t('downloadVideo.downloading') : t('downloadVideo.start')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

