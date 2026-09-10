import { useState, useCallback, useEffect, useRef } from "react"
import { Sidebar } from "@/components/sidebar/Sidebar"
import { Toolbar } from "@/components/sidebar/Toolbar"
import { RadioButtonGroup } from "@/components/ui/radio-button-group"
import { LayoutGrid, FolderOpen } from "lucide-react"
import { useUIMediaFolderStore, useUIMediaFolderStoreState } from "@/stores/uiMediaFolderStore"
import { useDialogs } from "@/providers/dialog-provider"
import type { FileItem, FolderType } from "@/providers/dialog-provider"
import { useTranslation } from "@/lib/i18n"
import { Toaster } from "./components/ui/sonner"
import { Assistant } from "./ai/Assistant"
import { StatusBar } from "./components/StatusBar"
import { AppWarningBanner } from "./components/AppWarningBanner"
import { Path } from "@smm/utils/path"
import Welcome from "./components/welcome"
import { FolderNotAvailablePanel } from "./components/FolderNotAvailablePanel"
import { PendingInitializationPanel } from "./components/PendingInitializationPanel"
import { ErrorLoadingPanel } from "./components/ErrorLoadingPanel"
import TvShowPanel from "./components/tv/TvShowPanel"
import MoviePanel from "./components/movie/MoviePanel"
import { LocalFilePanel } from "./components/LocalFilePanel"
import { logger } from "@/lib/log"
import { nextTraceId } from "@/lib/utils"
import { useConfig } from "@/hooks/userConfig"
import { useFeatures } from "@/hooks/useFeatures"
import { useMediaMetadataQuery } from "@/hooks/mediaMetadata"
import {
  UI_ImportFolderEvent,
  UI_MediaLibraryImportedEvent,
  type OnMediaFolderImportedEventData,
  type OnMediaLibraryImportedEventData,
} from "./types/eventTypes"
import { MusicPanel } from "./components/music/MusicPanel"
import { VideoCompression } from "./components/video-compression/VideoCompression"
import { FormatConverter } from "./components/format-converter/FormatConverter"
import { ScrapeMetadata } from "./components/scrape/ScrapeMetadata"
import { RenameFile } from "./components/rename-file/RenameFile"
import localStorages from "@/lib/localStorages"
import { useFoldersQuery, useUnimportFolderMutation } from "@/hooks/folders"
import { isElectron } from "@/lib/isElectron"
import { openNativeFolderDialog } from "@/lib/nativeFolderDialog"
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable"
import type { ImperativePanelHandle } from "react-resizable-panels"
import { AIArea } from "@/components/AIArea"
// WebSocketHandlers is now at AppSwitcher level to avoid disconnection on view switch

type ViewMode = "metadata" | "files"

export default function App() {
  // WebSocket connection is now established at AppSwitcher level to persist across view changes
  // No need to call useWebSocket() here anymore
  const { t } = useTranslation(["components"])
  const { userConfig, isUserConfigLoaded } = useConfig()
  const unimportFolderMutation = useUnimportFolderMutation()

  const { data: folders } = useFoldersQuery()
  const { selectedFolder, selectedFolders } = useUIMediaFolderStoreState()
  const hasFolders = (folders?.length ?? 0) > 0
  const { isAiAreaEnabled, isAiFeatureEnabled } = useFeatures()

  // View mode state
  const [viewMode, setViewMode] = useState<ViewMode>("metadata")

  // AI Area collapse state (only relevant when isAiAreaEnabled)
  const [isAIAreaCollapsed, setIsAIAreaCollapsed] = useState(false)
  const [isAIAreaAnimating, setIsAIAreaAnimating] = useState(false)
  const aiAreaPanelRef = useRef<ImperativePanelHandle>(null)
  const animateTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const handleToggleAIArea = useCallback(() => {
    const panel = aiAreaPanelRef.current
    if (!panel) return

    // Clear any pending animation timer
    if (animateTimerRef.current) {
      clearTimeout(animateTimerRef.current)
      animateTimerRef.current = undefined
    }

    setIsAIAreaAnimating(true)

    // Let React commit the transition class to DOM before changing size
    requestAnimationFrame(() => {
      if (panel.isCollapsed()) {
        panel.expand()
      } else {
        panel.collapse()
      }
    })

    // Remove animation class after transition completes
    animateTimerRef.current = setTimeout(() => {
      setIsAIAreaAnimating(false)
    }, 320)
  }, [])

  // Dialogs
  const { openFolderDialog, filePickerDialog, renameFolderDialog } = useDialogs()
  const [openOpenFolder] = openFolderDialog
  const [openFilePicker] = filePickerDialog
  const [openRenameFolder] = renameFolderDialog
  const folderStatus = useUIMediaFolderStore((s) => s.folders.find(f => f.path === selectedFolder)?.status)
  const folderType = useUIMediaFolderStore((s) => s.folders.find(f => f.path === selectedFolder)?.type)

  // Media metadata
  const { data: selectedMediaMetadata } = useMediaMetadataQuery(selectedFolder || undefined, { defaultType: folderType })

  const viewSwitcherDisabled =
    !hasFolders || !selectedMediaMetadata || folderStatus === "folder_not_found"


  // Log error when metadata is loaded but type is missing (e.g. race condition during import)
  useEffect(() => {
    if (selectedMediaMetadata && selectedMediaMetadata.type === undefined) {
      logger.error(
        `[App] selectedMediaMetadata.type is undefined for folder: ${selectedFolder ?? "(none)"}, folderStatus: ${folderStatus ?? "(none)"}`,
      )
    }
  }, [selectedMediaMetadata, selectedMediaMetadata?.type, selectedFolder, folderStatus])
  /** When metadata loads with a selection but folder store is still empty, align store (e.g. restored index). */
  useEffect(() => {
    const path = selectedMediaMetadata?.mediaFolderPath
    if (!path) return
    const { selectedFolder: sf } = useUIMediaFolderStore.getState()
    if (!sf) {
      useUIMediaFolderStore.getState().applyFolderClick(path, false)
    }
  }, [selectedMediaMetadata?.mediaFolderPath])

  useEffect(() => {
    if (!isUserConfigLoaded) return

    const normalizedSelectedFolder = selectedFolder ? Path.posix(selectedFolder) : undefined
    const normalizedPersistedSelection = localStorages.sidebarSelectedFolder
      ? Path.posix(localStorages.sidebarSelectedFolder)
      : undefined
    const hasSelectedFolderInConfig =
      normalizedSelectedFolder === undefined
        ? true
        : userConfig.folders.some((folder) => Path.posix(folder) === normalizedSelectedFolder)

    if (!hasSelectedFolderInConfig) {
      // Skip persisting to avoid overwriting folders with stale userConfig snapshot during import.
      return
    }

    if (normalizedSelectedFolder === normalizedPersistedSelection) {
      return
    }

    localStorages.sidebarSelectedFolder = normalizedSelectedFolder ?? null
  }, [isUserConfigLoaded, selectedFolder, userConfig.folders])

  const handleOpenFolderMenuClick = useCallback(() => {
    if (isElectron()) {
      openNativeFolderDialog().then((selectedFile) => {
        if (selectedFile) {
          openOpenFolder((type: FolderType) => {
            const traceId = `App:UserOpenFolder:` + nextTraceId()
            const data: OnMediaFolderImportedEventData = {
              type: type,
              folderPathInPlatformFormat: selectedFile.path,
              traceId: traceId,
            }

            document.dispatchEvent(new CustomEvent(UI_ImportFolderEvent, { detail: data }))
          }, selectedFile.path)
        }
      })
    } else {
      openFilePicker((file: FileItem) => {
        openOpenFolder((type: FolderType) => {
          const traceId = `App:UserOpenFolder:` + nextTraceId()
          const data: OnMediaFolderImportedEventData = {
            type: type,
            folderPathInPlatformFormat: file.path,
            traceId: traceId,
          }

          document.dispatchEvent(new CustomEvent(UI_ImportFolderEvent, { detail: data }))
        }, file.path)
      }, {
        title: "Select Folder",
        description: "Choose a folder to open",
        selectFolder: true
      })
    }
  }, [openOpenFolder, openFilePicker])

  const handleOpenMediaLibraryMenuClick = useCallback(() => {
    if (isElectron()) {
      openNativeFolderDialog({ title: 'Select Media Library' }).then((selectedFile) => {
        if (selectedFile) {
          openOpenFolder((type: FolderType) => {
            const detail: OnMediaLibraryImportedEventData = {
              libraryPathInPlatformFormat: selectedFile.path,
              type,
              traceId: `App:UserOpenMediaLibrary:${nextTraceId()}`,
            }
            document.dispatchEvent(new CustomEvent(UI_MediaLibraryImportedEvent, { detail }))
          }, selectedFile.path)
        }
      })
    } else {
      openFilePicker((file: FileItem) => {
        openOpenFolder((type: FolderType) => {
          const detail: OnMediaLibraryImportedEventData = {
            libraryPathInPlatformFormat: file.path,
            type,
            traceId: `App:UserOpenMediaLibrary:${nextTraceId()}`,
          }
            document.dispatchEvent(new CustomEvent(UI_MediaLibraryImportedEvent, { detail }))
        }, file.path)
      }, {
        title: "Select Media Library",
        description: "Choose a folder containing multiple media folders",
        selectFolder: true
      })
    }
  }, [openOpenFolder, openFilePicker])

  const onDeleteSelected = useCallback(
    async (paths: string[]) => {
      if (paths.length === 0) return

      await unimportFolderMutation.mutateAsync(paths)
    },
    [unimportFolderMutation],
  )

  return (
    <div className="flex h-full w-full flex-col overflow-hidden">
      <AppWarningBanner />
      <div className="min-h-0 flex-1 overflow-hidden">
        <ResizablePanelGroup key={isAiAreaEnabled ? "with-ai" : "no-ai"} direction="horizontal">
          {/* Left panel: Toolbar + (Sidebar | Content) */}
          <ResizablePanel defaultSize={75} minSize={50}>
            <div className="flex flex-col h-full">
              {/* Toolbar */}
              <div className="flex shrink-0 items-center gap-1.5 border-b border-border bg-muted/50 px-3 py-1.5 shadow-sm">
                <Toolbar
                  onOpenFolderMenuClick={handleOpenFolderMenuClick}
                  onOpenMediaLibraryMenuClick={handleOpenMediaLibraryMenuClick}
                  onToggleAIArea={isAiAreaEnabled ? handleToggleAIArea : undefined}
                  isAIAreaCollapsed={isAIAreaCollapsed}
                >
                  <RadioButtonGroup
                    options={[
                      { value: "metadata", label: t("viewSwitcher.metadataView"), icon: LayoutGrid },
                      { value: "files", label: t("viewSwitcher.filesView"), icon: FolderOpen },
                    ]}
                    value={viewMode}
                    onSelect={setViewMode}
                    disabled={viewSwitcherDisabled}
                  />
                </Toolbar>
              </div>
              {/* Sidebar | Content */}
              <div className="flex-1 min-h-0">
                <ResizablePanelGroup direction="horizontal">
                  {/* Sidebar */}
                  <ResizablePanel defaultSize={20} minSize={15} maxSize={45}>
                    <div className="min-w-0 overflow-hidden border-r border-border bg-muted/30 h-full">
                      <Sidebar
                        onDeleteSelected={onDeleteSelected}
                        onRenameFolder={(path) =>
                          openRenameFolder(path, {
                            title: t("mediaFolder.renameTitle"),
                            description: t("mediaFolder.renameDescription"),
                          })
                        }
                        selectedPaths={selectedFolders}
                        primaryPath={selectedFolder}
                        onSelectionChange={({ selectedPaths, primaryPath }) => {
                          useUIMediaFolderStore.setState({
                            selectedFolder: primaryPath,
                            selectedFolders: selectedPaths,
                          })
                        }}
                      />
                    </div>
                  </ResizablePanel>
                  <ResizableHandle withHandle />
                  {/* Content */}
                  <ResizablePanel>
                    <div className="flex flex-col overflow-hidden bg-background h-full">
                      {!hasFolders && (
                        <div style={{ padding: "20px", overflow: "auto" }}>
                          <Welcome onImportFolderClick={handleOpenFolderMenuClick} />
                        </div>
                      )}
                      {hasFolders && selectedFolder && folderStatus === "folder_not_found" && (
                        <FolderNotAvailablePanel />
                      )}
                      {hasFolders && selectedFolder && folderStatus === "pending_for_initialization" && (
                        <PendingInitializationPanel />
                      )}
                      {hasFolders &&
                        folderStatus !== "folder_not_found" &&
                        folderStatus !== "pending_for_initialization" &&
                        selectedMediaMetadata && (
                        <>
                          {viewMode === "metadata" && (
                            <>
                              {selectedMediaMetadata.type === "tvshow-folder" && (
                                <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
                                  <TvShowPanel />
                                </div>
                              )}
                              {selectedMediaMetadata.type === "movie-folder" && (
                                <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
                                  <MoviePanel />
                                </div>
                              )}
                              {selectedMediaMetadata.type === "music-folder" && (
                                <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
                                  <MusicPanel />
                                </div>
                              )}
                              {selectedMediaMetadata.type === undefined && (
                                <ErrorLoadingPanel />
                              )}
                              {selectedMediaMetadata.type !== "tvshow-folder" 
                              && selectedMediaMetadata.type !== "movie-folder"
                              && selectedMediaMetadata.type !== "music-folder" 
                              && selectedMediaMetadata.type !== undefined
                              && (folderStatus === "ok" || folderStatus === "error_loading_metadata")
                              && (
                                <LocalFilePanel mediaFolderPath={selectedMediaMetadata.mediaFolderPath} />
                              )}
                            </>
                          )}
                          {viewMode === "files" && (
                            <LocalFilePanel mediaFolderPath={selectedMediaMetadata.mediaFolderPath} />
                          )}
                        </>
                      )}
                    </div>
                  </ResizablePanel>
                </ResizablePanelGroup>
              </div>
            </div>
          </ResizablePanel>
          {isAiAreaEnabled && <ResizableHandle withHandle />}
          {isAiAreaEnabled && <ResizablePanel
            ref={aiAreaPanelRef}
            className={isAIAreaAnimating ? "transition-all duration-300 ease-in-out" : ""}
            defaultSize={25}
            minSize={10}
            maxSize={50}
            collapsible
            collapsedSize={0}
            onCollapse={() => setIsAIAreaCollapsed(true)}
            onExpand={() => setIsAIAreaCollapsed(false)}
          >
            <AIArea />
          </ResizablePanel>}
        </ResizablePanelGroup>
      </div>
      <StatusBar />
      {isAiFeatureEnabled && <Assistant />}
      <VideoCompression />
      <FormatConverter />
      <ScrapeMetadata />
      <RenameFile />
      <Toaster position="bottom-right" />
    </div>
  )
}



