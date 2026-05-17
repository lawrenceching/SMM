import { createContext, useContext, useState, useCallback } from "react"
import type { ReactNode } from "react"
import { useTranslation } from "@/lib/i18n"
import {
  ConfirmationDialog,
  SpinnerDialog,
  ConfigDialog,
  FilePickerDialog,
  DownloadVideoDialog,
  MediaSearchDialog,
  RenameFileDialog,
  RenameFolderDialog,
  OpenFolderDialog,
  ScrapeDialog,
  ScrapeDialogV2,
  FilePropertyDialog,
  FormatConverterDialog,
  EditMediaFileDialog,
  ExecuteCmdDialog,
  AddTestBackgroundJobDialog,
  LogDialog,
  type DialogConfig,
  type FolderType,
  type FileItem,
  type Task,
  type TrackProperties,
  type OpenEditMediaFileOptions,
  type ExecuteCmdType,
} from "@/components/dialogs"
import type { SettingsTab } from "@/components/ui/config-panel"
import { useConfig } from "@/hooks/userConfig"

const SCRAPE_DIALOG_V2_FALLBACK = true

function resolveScrapeDialogV2Flag(userConfig: unknown): boolean {
  if (!userConfig || typeof userConfig !== "object") return SCRAPE_DIALOG_V2_FALLBACK
  const cfg = userConfig as Record<string, unknown>

  if (typeof cfg.scrapeDialogV2 === "boolean") {
    return cfg.scrapeDialogV2
  }

  const experimental = cfg.experimental
  if (experimental && typeof experimental === "object") {
    const exp = experimental as Record<string, unknown>
    if (typeof exp.scrapeDialogV2 === "boolean") {
      return exp.scrapeDialogV2
    }
  }

  return SCRAPE_DIALOG_V2_FALLBACK
}

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
    openConfig: (initialTab?: SettingsTab) => void,
    closeConfig: () => void
  ]
  openFolderDialog: [
    openOpenFolder: (onSelect: (type: FolderType) => void, folderPath?: string) => void,
    closeOpenFolder: () => void
  ]
  filePickerDialog: [
    openFilePicker: (onSelect: (file: FileItem) => void, options?: { title?: string; description?: string; selectFolder?: boolean; initialPath?: string }) => void,
    closeFilePicker: () => void
  ]
  downloadVideoDialog: [
    openDownloadVideo: (destinationFolder?: string) => void,
    closeDownloadVideo: () => void
  ]
  mediaSearchDialog: [
    openMediaSearch: (onSelect?: (tmdbId: number) => void) => void,
    closeMediaSearch: () => void
  ]
  renameFileDialog: [
    openRenameFile: (onConfirm: (newName: string) => void, options?: { initialValue?: string; title?: string; description?: string; suggestions?: string[] }) => void,
    closeRenameFile: () => void
  ]
  renameFolderDialog: [
    openRenameFolder: (mediaFolderPath: string, options?: { title?: string; description?: string }) => void,
    closeRenameFolder: () => void
  ]
  scrapeDialog: [
    openScrape: (options?: { title?: string; description?: string; mediaMetadata?: import("@core/types").MediaMetadata }) => void,
    closeScrape: () => void
  ]
  filePropertyDialog: [
    openFileProperty: (track: TrackProperties) => void,
    closeFileProperty: () => void
  ]
  formatConverterDialog: [
    openFormatConverter: (track?: TrackProperties | string) => void,
    closeFormatConverter: () => void
  ]
  editMediaFileDialog: [
    openEditMediaFile: (options: OpenEditMediaFileOptions) => void,
    closeEditMediaFile: () => void
  ]
  executeCmdDialog: [
    openExecuteCmd: (initialCommand?: ExecuteCmdType) => void,
    closeExecuteCmd: () => void
  ]
  addTestBackgroundJobDialog: [
    openAddTestBackgroundJob: () => void,
    closeAddTestBackgroundJob: () => void
  ]
  logDialog: [
    openLogDialog: (options: { executionId: string; jobTitle: string; isRunning?: boolean }) => void,
    closeLogDialog: () => void
  ]
}

const DialogContext = createContext<DialogContextValue | undefined>(undefined)

interface DialogProviderProps {
  children: ReactNode
}

export function DialogProvider({ children }: DialogProviderProps) {
  const { userConfig } = useConfig()
  const useScrapeDialogV2 = resolveScrapeDialogV2Flag(userConfig)
  // Confirmation dialog state
  const [isConfirmationOpen, setIsConfirmationOpen] = useState(false)
  const [confirmationConfig, setConfirmationConfig] = useState<DialogConfig | null>(null)

  // Spinner dialog state
  const [isSpinnerOpen, setIsSpinnerOpen] = useState(false)
  const [spinnerMessage, setSpinnerMessage] = useState<string | undefined>(undefined)

  // Config dialog state
  const [isConfigOpen, setIsConfigOpen] = useState(false)
  const [configInitialTab, setConfigInitialTab] = useState<SettingsTab | undefined>(undefined)

  // Open folder dialog state
  const [isOpenFolderOpen, setIsOpenFolderOpen] = useState(false)
  const [openFolderOnSelect, setOpenFolderOnSelect] = useState<((type: FolderType) => void) | null>(null)
  const [openFolderPath, setOpenFolderPath] = useState<string | undefined>(undefined)

  // File picker dialog state
  const [isFilePickerOpen, setIsFilePickerOpen] = useState(false)
  const [filePickerOnSelect, setFilePickerOnSelect] = useState<((file: FileItem) => void) | null>(null)
  const [filePickerOptions, setFilePickerOptions] = useState<{ title?: string; description?: string; selectFolder?: boolean; initialPath?: string }>({})

  // Download video dialog state
  const [isDownloadVideoOpen, setIsDownloadVideoOpen] = useState(false)
  const [downloadVideoDestinationFolder, setDownloadVideoDestinationFolder] = useState<string | undefined>(undefined)

  // Media search dialog state
  const [isMediaSearchOpen, setIsMediaSearchOpen] = useState(false)
  const [mediaSearchOnSelect, setMediaSearchOnSelect] = useState<((tmdbId: number) => void) | null>(null)

  // Rename file dialog state
  const [isRenameFileOpen, setIsRenameFileOpen] = useState(false)
  const [renameFileOnConfirm, setRenameFileOnConfirm] = useState<((newName: string) => void) | null>(null)
  const [renameFileOptions, setRenameFileOptions] = useState<{ initialValue?: string; title?: string; description?: string; suggestions?: string[] }>({})

  // Rename folder dialog state
  const [isRenameFolderOpen, setIsRenameFolderOpen] = useState(false)
  const [renameFolderPath, setRenameFolderPath] = useState<string | null>(null)
  const [renameFolderOptions, setRenameFolderOptions] = useState<{ title?: string; description?: string }>({})

  // Scrape dialog state
  const [isScrapeOpen, setIsScrapeOpen] = useState(false)
  const [scrapeOptions, setScrapeOptions] = useState<{ title?: string; description?: string; mediaMetadata?: import("@core/types").MediaMetadata }>({})

  // File property dialog state
  const [isFilePropertyOpen, setIsFilePropertyOpen] = useState(false)
  const [filePropertyTrack, setFilePropertyTrack] = useState<TrackProperties | undefined>(undefined)

  // Format converter dialog state
  const [isFormatConverterOpen, setIsFormatConverterOpen] = useState(false)
  const [formatConverterTrack, setFormatConverterTrack] = useState<TrackProperties | undefined>(undefined)

  // Edit media file (tags) dialog state
  const [isEditMediaFileOpen, setIsEditMediaFileOpen] = useState(false)
  const [editMediaFilePath, setEditMediaFilePath] = useState<string | undefined>(undefined)

  // Execute command dialog state
  const [isExecuteCmdOpen, setIsExecuteCmdOpen] = useState(false)
  const [executeCmdInitialCommand, setExecuteCmdInitialCommand] = useState<ExecuteCmdType | undefined>(undefined)

  const [isAddTestBackgroundJobOpen, setIsAddTestBackgroundJobOpen] = useState(false)

  const [isLogDialogOpen, setIsLogDialogOpen] = useState(false)
  const [logDialogExecutionId, setLogDialogExecutionId] = useState('')
  const [logDialogJobTitle, setLogDialogJobTitle] = useState('')
  const [logDialogIsRunning, setLogDialogIsRunning] = useState(false)

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

  const openConfig = useCallback((initialTab?: SettingsTab) => {
    setConfigInitialTab(initialTab)
    setIsConfigOpen(true)
  }, [])

  const closeConfig = useCallback(() => {
    setIsConfigOpen(false)
    setTimeout(() => {
      setConfigInitialTab(undefined)
    }, 200)
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

  const openFilePicker = useCallback((onSelect: (file: FileItem) => void, options?: { title?: string; description?: string; selectFolder?: boolean; initialPath?: string }) => {
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

  const openDownloadVideo = useCallback((destinationFolder?: string) => {
    setDownloadVideoDestinationFolder(destinationFolder)
    setIsDownloadVideoOpen(true)
  }, [])

  const closeDownloadVideo = useCallback(() => {
    setIsDownloadVideoOpen(false)
    setTimeout(() => {
      setDownloadVideoDestinationFolder(undefined)
    }, 200)
  }, [])

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

  const openRenameFile = useCallback((onConfirm: (newName: string) => void, options?: { initialValue?: string; title?: string; description?: string; suggestions?: string[] }) => {
    setRenameFileOnConfirm(() => onConfirm)
    setRenameFileOptions(options || {})
    setIsRenameFileOpen(true)
  }, [])

  const openRenameFolder = useCallback(
    (mediaFolderPath: string, options?: { title?: string; description?: string }) => {
      setRenameFolderPath(mediaFolderPath)
      setRenameFolderOptions(options || {})
      setIsRenameFolderOpen(true)
    },
    []
  )

  const closeRenameFile = useCallback(() => {
    setIsRenameFileOpen(false)
    setTimeout(() => {
      setRenameFileOnConfirm(null)
      setRenameFileOptions({})
    }, 200)
  }, [])

  const closeRenameFolder = useCallback(() => {
    setIsRenameFolderOpen(false)
    setTimeout(() => {
      setRenameFolderPath(null)
      setRenameFolderOptions({})
    }, 200)
  }, [])

  const handleRenameFileConfirm = useCallback(
    (newName: string) => {
      renameFileOnConfirm?.(newName)
      closeRenameFile()
    },
    [renameFileOnConfirm, closeRenameFile]
  )

  const openScrape = useCallback((options?: { title?: string; description?: string; mediaMetadata?: import("@core/types").MediaMetadata }) => {
    setScrapeOptions(options || {})
    setIsScrapeOpen(true)
  }, [])

  const closeScrape = useCallback(() => {
    setIsScrapeOpen(false)
    setTimeout(() => {
      setScrapeOptions({})
    }, 200)
  }, [])

  const openFileProperty = useCallback((track: TrackProperties) => {
    setFilePropertyTrack(track)
    setIsFilePropertyOpen(true)
  }, [])

  const closeFileProperty = useCallback(() => {
    setIsFilePropertyOpen(false)
    setTimeout(() => {
      setFilePropertyTrack(undefined)
    }, 200)
  }, [])

  const openFormatConverter = useCallback((trackOrPath?: TrackProperties | string) => {
    const track: TrackProperties | undefined =
      trackOrPath === undefined
        ? undefined
        : typeof trackOrPath === 'string'
          ? { id: 0, path: trackOrPath, filePath: trackOrPath, title: '' }
          : trackOrPath
    setFormatConverterTrack(track)
    setIsFormatConverterOpen(true)
  }, [])

  const closeFormatConverter = useCallback(() => {
    setIsFormatConverterOpen(false)
    setTimeout(() => {
      setFormatConverterTrack(undefined)
    }, 200)
  }, [])

  const openEditMediaFile = useCallback((options: OpenEditMediaFileOptions) => {
    setEditMediaFilePath(options.path)
    setIsEditMediaFileOpen(true)
  }, [])

  const closeEditMediaFile = useCallback(() => {
    setIsEditMediaFileOpen(false)
    setTimeout(() => setEditMediaFilePath(undefined), 200)
  }, [])

  const openExecuteCmd = useCallback((initialCommand?: ExecuteCmdType) => {
    setExecuteCmdInitialCommand(initialCommand)
    setIsExecuteCmdOpen(true)
  }, [])

  const closeExecuteCmd = useCallback(() => {
    setIsExecuteCmdOpen(false)
    setTimeout(() => {
      setExecuteCmdInitialCommand(undefined)
    }, 200)
  }, [])

  const openAddTestBackgroundJob = useCallback(() => {
    setIsAddTestBackgroundJobOpen(true)
  }, [])

  const closeAddTestBackgroundJob = useCallback(() => {
    setIsAddTestBackgroundJobOpen(false)
  }, [])

  const openLogDialog = useCallback((options: { executionId: string; jobTitle: string; isRunning?: boolean }) => {
    setLogDialogExecutionId(options.executionId)
    setLogDialogJobTitle(options.jobTitle)
    setLogDialogIsRunning(options.isRunning ?? false)
    setIsLogDialogOpen(true)
  }, [])

  const closeLogDialog = useCallback(() => {
    setIsLogDialogOpen(false)
    setTimeout(() => {
      setLogDialogExecutionId('')
      setLogDialogJobTitle('')
      setLogDialogIsRunning(false)
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
    renameFileDialog: [openRenameFile, closeRenameFile],
    renameFolderDialog: [openRenameFolder, closeRenameFolder],
    scrapeDialog: [openScrape, closeScrape],
    filePropertyDialog: [openFileProperty, closeFileProperty],
    formatConverterDialog: [openFormatConverter, closeFormatConverter],
    editMediaFileDialog: [openEditMediaFile, closeEditMediaFile],
    executeCmdDialog: [openExecuteCmd, closeExecuteCmd],
    addTestBackgroundJobDialog: [openAddTestBackgroundJob, closeAddTestBackgroundJob],
    logDialog: [openLogDialog, closeLogDialog],
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
        initialTab={configInitialTab}
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
        selectFolder={filePickerOptions.selectFolder}
        initialPath={filePickerOptions.initialPath}
      />
      <DownloadVideoDialog
        isOpen={isDownloadVideoOpen}
        onClose={closeDownloadVideo}
        onOpenFilePicker={openFilePicker}
        destinationFolder={downloadVideoDestinationFolder}
      />
      <MediaSearchDialog
        isOpen={isMediaSearchOpen}
        onClose={closeMediaSearch}
        onSelect={mediaSearchOnSelect || undefined}
      />
      <RenameFileDialog
        isOpen={isRenameFileOpen}
        onClose={closeRenameFile}
        onConfirm={handleRenameFileConfirm}
        initialValue={renameFileOptions.initialValue}
        title={renameFileOptions.title}
        description={renameFileOptions.description}
        suggestions={renameFileOptions.suggestions}
      />
      {renameFolderPath && (
        <RenameFolderDialog
          isOpen={isRenameFolderOpen}
          onClose={closeRenameFolder}
          mediaFolderPath={renameFolderPath}
          title={renameFolderOptions.title}
          description={renameFolderOptions.description}
        />
      )}
      {useScrapeDialogV2 ? (
        <ScrapeDialogV2
          isOpen={isScrapeOpen}
          onClose={closeScrape}
          mediaMetadata={scrapeOptions.mediaMetadata}
        />
      ) : (
        <ScrapeDialog
          isOpen={isScrapeOpen}
          onClose={closeScrape}
          mediaMetadata={scrapeOptions.mediaMetadata}
        />
      )}
      <FilePropertyDialog
        isOpen={isFilePropertyOpen}
        onClose={closeFileProperty}
        track={filePropertyTrack}
      />
      <FormatConverterDialog
        isOpen={isFormatConverterOpen}
        onClose={closeFormatConverter}
        track={formatConverterTrack}
        onOpenFilePicker={openFilePicker}
        onSelectSource={(track: TrackProperties) => setFormatConverterTrack(track)}
      />
      <EditMediaFileDialog
        isOpen={isEditMediaFileOpen}
        onClose={closeEditMediaFile}
        path={editMediaFilePath}
      />
      <ExecuteCmdDialog
        isOpen={isExecuteCmdOpen}
        onClose={closeExecuteCmd}
        initialCommand={executeCmdInitialCommand}
      />
      <AddTestBackgroundJobDialog
        isOpen={isAddTestBackgroundJobOpen}
        onClose={closeAddTestBackgroundJob}
      />
      <LogDialog
        open={isLogDialogOpen}
        onOpenChange={(next) => {
          if (!next) closeLogDialog()
        }}
        executionId={logDialogExecutionId}
        jobTitle={logDialogJobTitle}
        isRunning={logDialogIsRunning}
      />
    </DialogContext.Provider>
  )
}

export function useDialogs(): DialogContextValue {
  const { t } = useTranslation('dialogs')
  const context = useContext(DialogContext)
  if (context === undefined) {
    throw new Error(t('errors.providerError'))
  }
  return context
}
