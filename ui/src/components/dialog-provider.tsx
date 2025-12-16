import { createContext, useContext, useState, useCallback, useEffect } from "react"
import type { ReactNode } from "react"
import { Loader2, File, FolderOpen } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { ConfigPanel } from "@/components/ui/config-panel"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { cn } from "@/lib/utils"
import { useConfig } from "./config-provider"
import { useMediaMetadata } from "./media-metadata-provider"
import { Path } from "@core/path"
import { readMediaMetadataApi } from "@/api/readMediaMatadata"
import { listFilesApi } from "@/api/listFiles"
import { MediaSearch } from "./MediaSearch"

interface DialogConfig {
  title?: string
  description?: string
  content?: ReactNode
  onClose?: () => void
  showCloseButton?: boolean
  className?: string
}

interface ConfirmationDialogProps {
  isOpen: boolean
  config: DialogConfig | null
  onClose: () => void
}

function ConfirmationDialog({ isOpen, config, onClose }: ConfirmationDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className={config?.className}
        showCloseButton={config?.showCloseButton}
      >
        {config?.title && (
          <DialogHeader>
            <DialogTitle>{config.title}</DialogTitle>
            {config.description && (
              <DialogDescription>{config.description}</DialogDescription>
            )}
          </DialogHeader>
        )}
        {config?.content}
      </DialogContent>
    </Dialog>
  )
}

interface SpinnerDialogProps {
  isOpen: boolean
  message?: string
}

function SpinnerDialog({ isOpen, message }: SpinnerDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={() => {}}>
      <DialogContent
        className="flex flex-col items-center justify-center gap-4 p-8"
        showCloseButton={false}
      >
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        {message && <p className="text-sm text-muted-foreground">{message}</p>}
      </DialogContent>
    </Dialog>
  )
}

interface ConfigDialogProps {
  isOpen: boolean
  onClose: () => void
}

function ConfigDialog({ isOpen, onClose }: ConfigDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className="p-0 flex flex-col"
        style={{
          maxWidth: '90vw',
          width: '100%',
          height: '90vh'
        }}
        showCloseButton={true}
      >
        <ConfigPanel />
      </DialogContent>
    </Dialog>
  )
}

export type FolderType = "tvshow" | "movie" | "music"

export interface FileItem {
  name: string
  path: string
  isDirectory?: boolean
}

interface FilePickerDialogProps {
  isOpen: boolean
  onClose: () => void
  onSelect: (file: FileItem) => void
  title?: string
  description?: string
}

function FilePickerDialog({ isOpen, onClose, onSelect, title = "Select File or Folder", description = "Choose a file or folder from the list" }: FilePickerDialogProps) {
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

interface DownloadVideoDialogProps {
  isOpen: boolean
  onClose: () => void
  onStart: (url: string, downloadFolder: string) => void
  onOpenFilePicker: (onSelect: (file: FileItem) => void) => void
}

function DownloadVideoDialog({ isOpen, onClose, onStart, onOpenFilePicker }: DownloadVideoDialogProps) {
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

interface MediaSearchDialogProps {
  isOpen: boolean
  onClose: () => void
  onSelect?: (tmdbId: number) => void
}

function MediaSearchDialog({ isOpen, onClose, onSelect }: MediaSearchDialogProps) {
  const [selectedTmdbId, setSelectedTmdbId] = useState<number | null>(null);

  const handleConfirm = () => {
    if (selectedTmdbId && onSelect) {
      onSelect(selectedTmdbId);
    }
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className="max-w-3xl overflow-hidden"
        showCloseButton={true}
      >
        <MediaSearch onSelect={(id) => setSelectedTmdbId(id)} />
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={!selectedTmdbId}>
            Confirm
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

interface OpenFolderDialogProps {
  isOpen: boolean
  onClose: () => void
  onSelect: (type: FolderType) => void
  folderPath?: string
}

function OpenFolderDialog({ isOpen, onClose, onSelect, folderPath }: OpenFolderDialogProps) {

  const { userConfig, setUserConfig } = useConfig()
  const { addMediaMetadata } = useMediaMetadata()

  const handleSelect = (type: FolderType) => {
    console.log(`[DialogProvider] handleSelect ${type} ${folderPath}`)

    if(!folderPath) {
      console.error("Folder path is required")
      onClose()
      return;
    }

    if(userConfig === undefined) {
      console.error("User config is required")
      onClose()
      return
    }

    setUserConfig({
      ...userConfig,
      folders: [...userConfig.folders, folderPath]
    })

    readMediaMetadataApi(folderPath).then((data) => {
      if(!!data.data) {
        console.log(`[OpenFolderDialog] Media metadata is already exists, skip adding new metadata`)
      } else {
        addMediaMetadata({
          mediaFolderPath: Path.posix(folderPath),
          type: type === "tvshow" ? "tvshow-folder" : type === "movie" ? "movie-folder" : "music-folder",
        })
      }
    })
    .catch((error) => {
      console.error("Failed to read media metadata:", error)
    })

    onSelect(type)
    onClose()
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent showCloseButton={true}>
        <DialogHeader>
          <DialogTitle>Select Folder Type</DialogTitle>
          <DialogDescription>
            Choose the type of media folder you want to open
          </DialogDescription>
        </DialogHeader>
        {folderPath && (
          <div className="flex items-center gap-2 p-3 rounded-md bg-muted border">
            <FolderOpen className="h-4 w-4 shrink-0 text-muted-foreground" />
            <div className="flex flex-col flex-1 min-w-0">
              <span className="text-xs font-medium text-muted-foreground">Folder Path</span>
              <span className="text-sm truncate">{folderPath}</span>
            </div>
          </div>
        )}
        <div className="flex flex-col gap-3 py-4">
          <Button
            variant="outline"
            className="w-full justify-start h-auto py-4"
            onClick={() => handleSelect("tvshow")}
          >
            <div className="flex flex-col items-start gap-1">
              <span className="font-semibold">Tv Show / Anime</span>
              <span className="text-xs text-muted-foreground">For television series and anime</span>
            </div>
          </Button>
          <Button
            variant="outline"
            className="w-full justify-start h-auto py-4"
            onClick={() => handleSelect("movie")}
          >
            <div className="flex flex-col items-start gap-1">
              <span className="font-semibold">Movie</span>
              <span className="text-xs text-muted-foreground">For movies and films</span>
            </div>
          </Button>
          <Button
            variant="outline"
            className="w-full justify-start h-auto py-4"
            onClick={() => handleSelect("music")}
          >
            <div className="flex flex-col items-start gap-1">
              <span className="font-semibold">Music</span>
              <span className="text-xs text-muted-foreground">For music albums and tracks</span>
            </div>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

interface DialogContextValue {
  confirmationDialog: [
    openConfirmation: (config: DialogConfig) => void,
    closeConfirmation: () => void
  ]
  spinnerDialog: [
    openSpinner: (message?: string) => void,
    closeSpinner: () => void
  ]
  configDialog: [
    openConfig: () => void,
    closeConfig: () => void
  ]
  openFolderDialog: [
    openOpenFolder: (onSelect: (type: FolderType) => void, folderPath?: string) => void,
    closeOpenFolder: () => void
  ]
  filePickerDialog: [
    openFilePicker: (onSelect: (file: FileItem) => void, options?: { title?: string; description?: string }) => void,
    closeFilePicker: () => void
  ]
  downloadVideoDialog: [
    openDownloadVideo: (onStart: (url: string, downloadFolder: string) => void) => void,
    closeDownloadVideo: () => void
  ]
  mediaSearchDialog: [
    openMediaSearch: (onSelect?: (tmdbId: number) => void) => void,
    closeMediaSearch: () => void
  ]
}

const DialogContext = createContext<DialogContextValue | undefined>(undefined)

interface DialogProviderProps {
  children: ReactNode
}

export function DialogProvider({ children }: DialogProviderProps) {
  // Confirmation dialog state
  const [isConfirmationOpen, setIsConfirmationOpen] = useState(false)
  const [confirmationConfig, setConfirmationConfig] = useState<DialogConfig | null>(null)

  // Spinner dialog state
  const [isSpinnerOpen, setIsSpinnerOpen] = useState(false)
  const [spinnerMessage, setSpinnerMessage] = useState<string | undefined>(undefined)

  // Config dialog state
  const [isConfigOpen, setIsConfigOpen] = useState(false)

  // Open folder dialog state
  const [isOpenFolderOpen, setIsOpenFolderOpen] = useState(false)
  const [openFolderOnSelect, setOpenFolderOnSelect] = useState<((type: FolderType) => void) | null>(null)
  const [openFolderPath, setOpenFolderPath] = useState<string | undefined>(undefined)

  // File picker dialog state
  const [isFilePickerOpen, setIsFilePickerOpen] = useState(false)
  const [filePickerOnSelect, setFilePickerOnSelect] = useState<((file: FileItem) => void) | null>(null)
  const [filePickerOptions, setFilePickerOptions] = useState<{ title?: string; description?: string }>({})

  // Download video dialog state
  const [isDownloadVideoOpen, setIsDownloadVideoOpen] = useState(false)
  const [downloadVideoOnStart, setDownloadVideoOnStart] = useState<((url: string, downloadFolder: string) => void) | null>(null)

  // Media search dialog state
  const [isMediaSearchOpen, setIsMediaSearchOpen] = useState(false)
  const [mediaSearchOnSelect, setMediaSearchOnSelect] = useState<((tmdbId: number) => void) | null>(null)

  const openConfirmation = useCallback((dialogConfig: DialogConfig) => {
    setConfirmationConfig(dialogConfig)
    setIsConfirmationOpen(true)
  }, [])

  const closeConfirmation = useCallback(() => {
    setIsConfirmationOpen(false)
    if (confirmationConfig?.onClose) {
      confirmationConfig.onClose()
    }
    // Clear config after a brief delay to allow animations to complete
    setTimeout(() => {
      setConfirmationConfig(null)
    }, 200)
  }, [confirmationConfig])

  const openSpinner = useCallback((message?: string) => {
    setSpinnerMessage(message)
    setIsSpinnerOpen(true)
  }, [])

  const closeSpinner = useCallback(() => {
    setIsSpinnerOpen(false)
    setTimeout(() => {
      setSpinnerMessage(undefined)
    }, 200)
  }, [])

  const openConfig = useCallback(() => {
    setIsConfigOpen(true)
  }, [])

  const closeConfig = useCallback(() => {
    setIsConfigOpen(false)
  }, [])

  const openOpenFolder = useCallback((onSelect: (type: FolderType) => void, folderPath?: string) => {
    setOpenFolderOnSelect(() => onSelect)
    setOpenFolderPath(folderPath)
    setIsOpenFolderOpen(true)
  }, [])

  const closeOpenFolder = useCallback(() => {
    setIsOpenFolderOpen(false)
    setTimeout(() => {
      setOpenFolderOnSelect(null)
      setOpenFolderPath(undefined)
    }, 200)
  }, [])

  const handleFolderTypeSelect = useCallback((type: FolderType) => {
    if (openFolderOnSelect) {
      openFolderOnSelect(type)
    }
    closeOpenFolder()
  }, [openFolderOnSelect, closeOpenFolder])

  const openFilePicker = useCallback((onSelect: (file: FileItem) => void, options?: { title?: string; description?: string }) => {
    setFilePickerOnSelect(() => onSelect)
    setFilePickerOptions(options || {})
    setIsFilePickerOpen(true)
  }, [])

  const closeFilePicker = useCallback(() => {
    setIsFilePickerOpen(false)
    setTimeout(() => {
      setFilePickerOnSelect(null)
      setFilePickerOptions({})
    }, 200)
  }, [])

  const handleFileSelect = useCallback((file: FileItem) => {
    if (filePickerOnSelect) {
      filePickerOnSelect(file)
    }
    closeFilePicker()
  }, [filePickerOnSelect, closeFilePicker])

  const openDownloadVideo = useCallback((onStart: (url: string, downloadFolder: string) => void) => {
    setDownloadVideoOnStart(() => onStart)
    setIsDownloadVideoOpen(true)
  }, [])

  const closeDownloadVideo = useCallback(() => {
    setIsDownloadVideoOpen(false)
    setTimeout(() => {
      setDownloadVideoOnStart(null)
    }, 200)
  }, [])

  const handleDownloadStart = useCallback((url: string, downloadFolder: string) => {
    if (downloadVideoOnStart) {
      downloadVideoOnStart(url, downloadFolder)
    }
    // Don't close the dialog automatically - let the download complete
  }, [downloadVideoOnStart])

  const openMediaSearch = useCallback((onSelect?: (tmdbId: number) => void) => {
    setMediaSearchOnSelect(() => onSelect || null)
    setIsMediaSearchOpen(true)
  }, [])

  const closeMediaSearch = useCallback(() => {
    setIsMediaSearchOpen(false)
    setTimeout(() => {
      setMediaSearchOnSelect(null)
    }, 200)
  }, [])

  const value: DialogContextValue = {
    confirmationDialog: [openConfirmation, closeConfirmation],
    spinnerDialog: [openSpinner, closeSpinner],
    configDialog: [openConfig, closeConfig],
    openFolderDialog: [openOpenFolder, closeOpenFolder],
    filePickerDialog: [openFilePicker, closeFilePicker],
    downloadVideoDialog: [openDownloadVideo, closeDownloadVideo],
    mediaSearchDialog: [openMediaSearch, closeMediaSearch],
  }

  return (
    <DialogContext.Provider value={value}>
      {children}
      <ConfirmationDialog
        isOpen={isConfirmationOpen}
        config={confirmationConfig}
        onClose={closeConfirmation}
      />
      <SpinnerDialog
        isOpen={isSpinnerOpen}
        message={spinnerMessage}
      />
      <ConfigDialog
        isOpen={isConfigOpen}
        onClose={closeConfig}
      />
      <OpenFolderDialog
        isOpen={isOpenFolderOpen}
        onClose={closeOpenFolder}
        onSelect={handleFolderTypeSelect}
        folderPath={openFolderPath}
      />
      <FilePickerDialog
        isOpen={isFilePickerOpen}
        onClose={closeFilePicker}
        onSelect={handleFileSelect}
        title={filePickerOptions.title}
        description={filePickerOptions.description}
      />
      <DownloadVideoDialog
        isOpen={isDownloadVideoOpen}
        onClose={closeDownloadVideo}
        onStart={handleDownloadStart}
        onOpenFilePicker={openFilePicker}
      />
      <MediaSearchDialog
        isOpen={isMediaSearchOpen}
        onClose={closeMediaSearch}
        onSelect={mediaSearchOnSelect || undefined}
      />
    </DialogContext.Provider>
  )
}

export function useDialogs(): DialogContextValue {
  const context = useContext(DialogContext)
  if (context === undefined) {
    throw new Error("useDialogs must be used within a DialogProvider")
  }
  return context
}
