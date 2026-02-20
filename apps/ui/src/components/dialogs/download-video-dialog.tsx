import { useState } from "react"
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
import { downloadYtdlpVideo } from "@/api/ytdlp"
import { toast } from "sonner"

export function DownloadVideoDialog({ isOpen, onClose, onStart, onOpenFilePicker }: DownloadVideoDialogProps) {
  const { t } = useTranslation(['dialogs', 'common'])
  const [url, setUrl] = useState("")
  const [downloadFolder, setDownloadFolder] = useState("")
  const [progress, setProgress] = useState(0)
  const [isDownloading, setIsDownloading] = useState(false)

  const handleStart = async () => {
    if (url.trim() && downloadFolder.trim()) {
      setIsDownloading(true)
      setProgress(0)

      // Call the ytdlp API to start download
      const result = await downloadYtdlpVideo({
        url: url.trim(),
        folder: downloadFolder.trim(),
      })

      setIsDownloading(false)
      setProgress(100)

      if (result.error) {
        toast.error(result.error)
      } else if (result.success) {
        toast.success(`Downloaded to: ${result.path}`)
        onClose()
      }

      onStart(url.trim(), downloadFolder.trim())
    }
  }

  const handleCancel = () => {
    setUrl("")
    setDownloadFolder("")
    setProgress(0)
    setIsDownloading(false)
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
              placeholder="https://example.com/video.mp4"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              disabled={isDownloading}
            />
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
          <Button onClick={handleStart} disabled={!url.trim() || !downloadFolder.trim() || isDownloading}>
            {isDownloading ? t('downloadVideo.downloading') : t('downloadVideo.start')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

