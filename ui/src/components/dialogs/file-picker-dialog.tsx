import { useState, useCallback, useEffect } from "react"
import { Loader2, File, FolderOpen } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"
import { listFilesApi } from "@/api/listFiles"
import type { FilePickerDialogProps, FileItem } from "./types"

export function FilePickerDialog({ 
  isOpen, 
  onClose, 
  onSelect, 
  title = "Select File or Folder", 
  description = "Choose a file or folder from the list" 
}: FilePickerDialogProps) {
  const [selectedFile, setSelectedFile] = useState<FileItem | null>(null)
  const [files, setFiles] = useState<FileItem[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [currentPath, setCurrentPath] = useState<string>("~")
  const [pathHistory, setPathHistory] = useState<string[]>(["~"])

  const loadFiles = useCallback(async (path: string) => {
    setIsLoading(true)
    setError(null)
    try {
      // Make two API calls: one for folders, one for files
      const [foldersResponse, filesResponse] = await Promise.all([
        listFilesApi(path, {
          onlyFolders: true,
          includeHiddenFiles: false,
        }),
        listFilesApi(path, {
          onlyFiles: true,
          includeHiddenFiles: false,
        }),
      ])
      
      if (foldersResponse.error || filesResponse.error) {
        setError(foldersResponse.error || filesResponse.error || 'Failed to load files')
        setFiles([])
      } else {
        // Convert folders to FileItem format
        const folders: FileItem[] = foldersResponse.data.map((filePath) => {
          const pathParts = filePath.split(/[/\\]/)
          const name = pathParts[pathParts.length - 1] || filePath
          return {
            name,
            path: filePath,
            isDirectory: true,
          }
        })

        // Convert files to FileItem format
        const files: FileItem[] = filesResponse.data.map((filePath) => {
          const pathParts = filePath.split(/[/\\]/)
          const name = pathParts[pathParts.length - 1] || filePath
          return {
            name,
            path: filePath,
            isDirectory: false,
          }
        })

        // Sort: folders first, then files, both alphabetically
        const sortedFolders = folders.sort((a, b) => a.name.localeCompare(b.name))
        const sortedFiles = files.sort((a, b) => a.name.localeCompare(b.name))
        
        setFiles([...sortedFolders, ...sortedFiles])
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load files')
      setFiles([])
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Load files when dialog opens or path changes
  useEffect(() => {
    if (isOpen) {
      loadFiles(currentPath)
    } else {
      // Reset state when dialog closes
      setFiles([])
      setSelectedFile(null)
      setError(null)
      setCurrentPath("~")
      setPathHistory(["~"])
    }
  }, [isOpen, currentPath, loadFiles])

  const handleItemClick = (file: FileItem) => {
    // Single-click: select file or folder
    setSelectedFile(file)
  }

  const handleItemDoubleClick = (file: FileItem) => {
    // Double-click: navigate into folder
    if (file.isDirectory) {
      setPathHistory([...pathHistory, currentPath])
      setCurrentPath(file.path)
      setSelectedFile(null)
    }
  }

  const handleGoBack = () => {
    if (pathHistory.length > 1) {
      const newHistory = [...pathHistory]
      newHistory.pop() // Remove current path
      const previousPath = newHistory[newHistory.length - 1]
      setPathHistory(newHistory)
      setCurrentPath(previousPath)
      setSelectedFile(null)
    }
  }

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
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2 overflow-hidden">
          {/* Current path and navigation */}
          <div className="flex items-center gap-2 min-w-0">
            {pathHistory.length > 1 && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleGoBack}
                disabled={isLoading}
                className="shrink-0"
              >
                ← Back
              </Button>
            )}
            <div className="flex-1 text-sm text-muted-foreground truncate min-w-0">
              {currentPath}
            </div>
          </div>
          <div className="h-[400px] w-full rounded-md border overflow-hidden relative" id="file-picker-scroll-container">
            <style>{`
              #file-picker-scroll-container [data-slot="scroll-area-viewport"] {
                display: block !important;
                width: 100% !important;
                max-width: 100% !important;
                min-width: 0 !important;
                table-layout: auto !important;
              }
            `}</style>
            <ScrollArea className="h-full w-full">
              <div className="p-4 w-full max-w-full box-border">
                {isLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  </div>
                ) : error ? (
                  <div className="flex items-center justify-center py-8 text-sm text-destructive">
                    {error}
                  </div>
                ) : files.length === 0 ? (
                  <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
                    No files or folders found
                  </div>
                ) : (
                  <div className="flex flex-col gap-1 w-full max-w-full box-border">
                    {files.map((file) => (
                      <div
                        key={file.path}
                        onClick={() => handleItemClick(file)}
                        onDoubleClick={() => handleItemDoubleClick(file)}
                        className={cn(
                          "flex items-center gap-3 p-3 rounded-md cursor-pointer transition-colors",
                          "hover:bg-accent hover:text-accent-foreground",
                          selectedFile?.path === file.path && "bg-primary/10 ring-2 ring-primary ring-inset"
                        )}
                        style={{ width: '100%', maxWidth: '100%', boxSizing: 'border-box', minWidth: 0 }}
                      >
                        {file.isDirectory ? (
                          <FolderOpen className="h-4 w-4 shrink-0" />
                        ) : (
                          <File className="h-4 w-4 shrink-0" />
                        )}
                        <div className="flex flex-col flex-1 overflow-hidden" style={{ minWidth: 0, maxWidth: '100%' }}>
                          <span className="font-medium truncate">{file.name}</span>
                          <span className="text-xs text-muted-foreground truncate">{file.path}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>
          {selectedFile && (
            <div className="flex justify-end gap-2 pt-2 shrink-0">
              <Button variant="outline" onClick={handleCancel}>
                Cancel
              </Button>
              <Button onClick={handleConfirm}>
                Confirm
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

