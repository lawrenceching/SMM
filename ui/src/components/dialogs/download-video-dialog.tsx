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

export function DownloadVideoDialog({ isOpen, onClose, onStart, onOpenFilePicker }: DownloadVideoDialogProps) {
  const [url, setUrl] = useState("")
  const [downloadFolder, setDownloadFolder] = useState("")
  const [progress, setProgress] = useState(0)
  const [isDownloading, setIsDownloading] = useState(false)

  const handleStart = () => {
    if (url.trim() && downloadFolder.trim()) {
      setIsDownloading(true)
      setProgress(0)
      onStart(url.trim(), downloadFolder.trim())
      // TODO: Update progress based on actual download progress
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
          <DialogTitle>Download Video</DialogTitle>
          <DialogDescription>
            Enter the video URL and select the download folder
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4 py-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="url">Video URL</Label>
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
            <Label htmlFor="downloadFolder">Download Folder</Label>
            <div className="flex gap-2">
              <Input
                id="downloadFolder"
                type="text"
                placeholder="Select download folder..."
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
                <span className="text-muted-foreground">Downloading...</span>
                <span className="text-muted-foreground">{progress}%</span>
              </div>
              <Progress value={progress} />
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2 pt-4">
          <Button variant="outline" onClick={handleCancel} disabled={isDownloading}>
            Cancel
          </Button>
          <Button onClick={handleStart} disabled={!url.trim() || !downloadFolder.trim() || isDownloading}>
            {isDownloading ? "Downloading..." : "Start"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

