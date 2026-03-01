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
import { getParentDirectory } from "./FilePickerDialogUtils"
import localStorages from "@/lib/localStorages"

export function FilePickerDialog({
  isOpen,
  onClose,
  onSelect,
  title,
  description,
  hideDialogHeader = true,
  selectFolder = false,
  initialPath
}: FilePickerDialogProps) {
  const { t } = useTranslation(['dialogs', 'common'])
  const defaultTitle = title || t('filePicker.defaultTitle')
  const defaultDescription = description || t('filePicker.defaultDescription')
  
  const [selectedFile, setSelectedFile] = useState<FileItem | null>(null)
  const [currentPath, setCurrentPath] = useState<string>(initialPath || localStorages.filePickerLastDir || "~")

  // Load saved last directory when dialog opens, or use initialPath if provided
  useEffect(() => {
    if (isOpen) {
      if (initialPath) {
        setCurrentPath(initialPath)
      } else {
        const saved = localStorages.filePickerLastDir
        if (saved) {
          setCurrentPath(saved)
        }
      }
    } else {
      // Reset state when dialog closes
      setSelectedFile(null)
      // Don't reset currentPath to "~" - keep it for next time
    }
  }, [isOpen, initialPath])

  // Debug: log state when dialog is open (helps verify selectFolder + no selection case)
  useEffect(() => {
    if (isOpen) {
      console.log("[FilePickerDialog] state", {
        selectFolder,
        selectedFile,
        currentPath,
      })
    }
  }, [isOpen, selectFolder, selectedFile, currentPath])

  const handleConfirm = () => {
    const log = (msg: string, data?: unknown) =>
      console.log("[FilePickerDialog] handleConfirm", msg, data !== undefined ? data : "")

    log("invoked", { selectedFile, selectFolder, currentPath })

    let itemToSelect: FileItem | null = null

    if (selectedFile) {
      // Validate that a folder is selected when selectFolder is true
      if (selectFolder && !selectedFile.isDirectory) {
        log("reject: selectFolder mode but selected item is not a directory")
        return
      }
      itemToSelect = selectedFile
      log("branch: use selectedFile", itemToSelect)
    } else if (selectFolder) {
      // 选择文件夹模式下未选中任何项时，表示选择当前路径
      const normalizedPath = currentPath.replace(/[/\\]+$/, "")
      const segments = normalizedPath.split(/[/\\]/).filter(Boolean)
      const name = segments.length > 0 ? segments[segments.length - 1] : currentPath
      itemToSelect = { name, path: currentPath, isDirectory: true }
      log("branch: use currentPath as folder", itemToSelect)
    } else {
      log("branch: no selection and not selectFolder, itemToSelect stays null")
    }

    if (itemToSelect) {
      const parentDir = getParentDirectory(itemToSelect.path)
      localStorages.filePickerLastDir = parentDir
      log("calling onSelect and closing", { itemToSelect, parentDir })
      onSelect(itemToSelect)
      setSelectedFile(null)
      onClose()
    } else {
      log("no itemToSelect, confirm does nothing")
    }
  }

  const handleCancel = () => {
    setSelectedFile(null)
    onClose()
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleCancel()}>
      <DialogContent 
        showCloseButton={true} 
        className="max-w-2xl overflow-hidden"
        onInteractOutside={(e) => e.preventDefault()}
      >

        {
          !hideDialogHeader && (
            <DialogHeader>
              <DialogTitle>{defaultTitle}</DialogTitle>
              <DialogDescription>{defaultDescription}</DialogDescription>
            </DialogHeader>
          )
        }
        <div className="flex flex-col gap-2 overflow-hidden">
          <div className="h-[400px] w-full flex flex-col min-h-0">
            <FileExplorer
              currentPath={currentPath}
              onPathChange={setCurrentPath}
              selectedFile={selectedFile}
              onFileSelect={setSelectedFile}
              initialPath={currentPath}
              showPathBar={true}
              showStatusBar={false}
              restrictToInitialPath={false}
              visibleColumns={['name']}
              onlyFolders={selectFolder}
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

