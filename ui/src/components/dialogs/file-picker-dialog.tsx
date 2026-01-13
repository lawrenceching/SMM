import { useState, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { FileExplorer } from "@/components/FileExplorer"
import type { FilePickerDialogProps, FileItem } from "./types"
import { useTranslation } from "@/lib/i18n"

export function FilePickerDialog({
  isOpen,
  onClose,
  onSelect,
  title,
  description
}: FilePickerDialogProps) {
  const { t } = useTranslation(['dialogs', 'common'])
  const defaultTitle = title || t('filePicker.defaultTitle')
  const defaultDescription = description || t('filePicker.defaultDescription')
  const [selectedFile, setSelectedFile] = useState<FileItem | null>(null)
  const [currentPath, setCurrentPath] = useState<string>("~")

  // Reset state when dialog closes
  useEffect(() => {
    if (!isOpen) {
      setSelectedFile(null)
      setCurrentPath("~")
    }
  }, [isOpen])

  const handleConfirm = () => {
    if (selectedFile) {
      onSelect(selectedFile)
      setSelectedFile(null)
      onClose()
    }
  }

  const handleCancel = () => {
    setSelectedFile(null)
    onClose()
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleCancel()}>
      <DialogContent showCloseButton={true} className="max-w-2xl overflow-hidden">
        <DialogHeader>
          <DialogTitle>{defaultTitle}</DialogTitle>
          <DialogDescription>{defaultDescription}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2 overflow-hidden">
          <div className="h-[400px] w-full flex flex-col min-h-0">
            <FileExplorer
              currentPath={currentPath}
              onPathChange={setCurrentPath}
              selectedFile={selectedFile}
              onFileSelect={setSelectedFile}
              initialPath="~"
              showPathBar={true}
              restrictToInitialPath={false}
            />
          </div>
          <div className="flex justify-end gap-2 pt-2 shrink-0">
            <Button variant="outline" onClick={handleCancel}>
              {t('cancel', { ns: 'common' })}
            </Button>
            <Button onClick={handleConfirm}>
              {t('confirm', { ns: 'common' })}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

