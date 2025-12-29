import { createContext, useContext, useState, useCallback } from "react"
import type { ReactNode } from "react"
import {
  ConfirmationDialog,
  SpinnerDialog,
  ConfigDialog,
  FilePickerDialog,
  DownloadVideoDialog,
  MediaSearchDialog,
  RenameDialog,
  OpenFolderDialog,
  ScrapeDialog,
  type DialogConfig,
  type FolderType,
  type FileItem,
  type Task,
} from "@/components/dialogs"

// Re-export types for backward compatibility
export type { FolderType, FileItem, Task }

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
  renameDialog: [
    openRename: (onConfirm: (newName: string) => void, options?: { initialValue?: string; title?: string; description?: string; suggestions?: string[] }) => void,
    closeRename: () => void
  ]
  scrapeDialog: [
    openScrape: (tasks: Task[], options?: { title?: string; description?: string; onStart?: () => void }) => void,
    closeScrape: () => void,
    updateTasks: (tasks: Task[]) => void
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

  // Rename dialog state
  const [isRenameOpen, setIsRenameOpen] = useState(false)
  const [renameOnConfirm, setRenameOnConfirm] = useState<((newName: string) => void) | null>(null)
  const [renameOptions, setRenameOptions] = useState<{ initialValue?: string; title?: string; description?: string; suggestions?: string[] }>({})

  // Scrape dialog state
  const [isScrapeOpen, setIsScrapeOpen] = useState(false)
  const [scrapeTasks, setScrapeTasks] = useState<Task[]>([])
  const [scrapeOptions, setScrapeOptions] = useState<{ title?: string; description?: string; onStart?: () => void }>({})

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

  const openRename = useCallback((onConfirm: (newName: string) => void, options?: { initialValue?: string; title?: string; description?: string; suggestions?: string[] }) => {
    setRenameOnConfirm(() => onConfirm)
    setRenameOptions(options || {})
    setIsRenameOpen(true)
  }, [])

  const closeRename = useCallback(() => {
    setIsRenameOpen(false)
    setTimeout(() => {
      setRenameOnConfirm(null)
      setRenameOptions({})
    }, 200)
  }, [])

  const handleRenameConfirm = useCallback((newName: string) => {
    if (renameOnConfirm) {
      renameOnConfirm(newName)
    }
    closeRename()
  }, [renameOnConfirm, closeRename])

  const openScrape = useCallback((tasks: Task[], options?: { title?: string; description?: string; onStart?: () => void }) => {
    setScrapeTasks(tasks)
    setScrapeOptions(options || {})
    setIsScrapeOpen(true)
  }, [])

  const closeScrape = useCallback(() => {
    setIsScrapeOpen(false)
    setTimeout(() => {
      setScrapeTasks([])
      setScrapeOptions({})
    }, 200)
  }, [])

  const updateTasks = useCallback((tasks: Task[]) => {
    setScrapeTasks(tasks)
  }, [])

  const value: DialogContextValue = {
    confirmationDialog: [openConfirmation, closeConfirmation],
    spinnerDialog: [openSpinner, closeSpinner],
    configDialog: [openConfig, closeConfig],
    openFolderDialog: [openOpenFolder, closeOpenFolder],
    filePickerDialog: [openFilePicker, closeFilePicker],
    downloadVideoDialog: [openDownloadVideo, closeDownloadVideo],
    mediaSearchDialog: [openMediaSearch, closeMediaSearch],
    renameDialog: [openRename, closeRename],
    scrapeDialog: [openScrape, closeScrape, updateTasks],
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
      <RenameDialog
        isOpen={isRenameOpen}
        onClose={closeRename}
        onConfirm={handleRenameConfirm}
        initialValue={renameOptions.initialValue}
        title={renameOptions.title}
        description={renameOptions.description}
        suggestions={renameOptions.suggestions}
      />
      <ScrapeDialog
        isOpen={isScrapeOpen}
        onClose={closeScrape}
        tasks={scrapeTasks}
        title={scrapeOptions.title}
        description={scrapeOptions.description}
        onStart={scrapeOptions.onStart}
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
