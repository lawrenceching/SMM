import { useState, useCallback, useEffect, useRef } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { Sidebar } from "@/components/v2/Sidebar"
import { Toolbar } from "@/components/v2/Toolbar"
import type { ViewMode } from "@/components/v2/ViewSwitcher"
import { useUIMediaFolderStore, useUIMediaFolderStoreState } from "@/stores/uiMediaFolderStore"
import { useDialogs } from "@/providers/dialog-provider"
import type { FileItem, FolderType } from "@/providers/dialog-provider"
import { Toaster } from "./components/ui/sonner"
import { toast } from "sonner"
import { mediaMetadataRepository } from "@/api/mediaMetadataRepository"
import { Assistant } from "./ai/Assistant"
import { StatusBar } from "./components/StatusBar"
import { AppWarningBanner } from "./components/AppWarningBanner"
import { Path } from "@core/path"
import Welcome from "./components/welcome"
import { FolderNotAvailablePanel } from "./components/FolderNotAvailablePanel"
import TvShowPanel from "./components/TvShowPanel"
import MoviePanel from "./components/MoviePanel"
import { LocalFilePanel } from "./components/LocalFilePanel"
import { nextTraceId } from "@/lib/utils"
import { useConfig } from "@/hooks/userConfig"
import { useFeatures } from "@/hooks/useFeatures"
import { isNotNil } from "es-toolkit"
import type { UIMediaMetadata } from "@/types/UIMediaMetadata"
import {
  mediaMetadataQueryKey,
  normalizeMediaFolderPathForQuery,
  useMediaMetadataQuery,
} from "@/hooks/mediaMetadata"
import {
  UI_MediaFolderImportedEvent,
  UI_MediaLibraryImportedEvent,
  type OnMediaFolderImportedEventData,
  type OnMediaLibraryImportedEventData,
} from "./types/eventTypes"
import { MusicPanel } from "./components/MusicPanel"
import localStorages from "@/lib/localStorages"
import { isElectron } from "@/lib/isElectron"
import { openNativeFolderDialog } from "@/lib/nativeFolderDialog"
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable"
import type { ImperativePanelHandle } from "react-resizable-panels"
import { AIArea } from "@/components/AIArea"
// WebSocketHandlers is now at AppSwitcher level to avoid disconnection on view switch

function AppV2Content() {
  // WebSocket connection is now established at AppSwitcher level to persist across view changes
  // No need to call useWebSocket() here anymore
  const { userConfig, setAndSaveUserConfig, isUserConfigLoaded } = useConfig()

  const { folders: uiFolders, selectedFolder } = useUIMediaFolderStoreState()
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
  const { openFolderDialog, filePickerDialog } = useDialogs()
  const [openOpenFolder] = openFolderDialog
  const [openFilePicker] = filePickerDialog
  const queryClient = useQueryClient()
  const folderStatus = useUIMediaFolderStore((s) => s.folders.find(f => f.path === selectedFolder)?.status)

  // Media metadata
  const { data: selectedMediaMetadata } = useMediaMetadataQuery(selectedFolder || undefined)

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
            const traceId = `AppV2:UserOpenFolder:` + nextTraceId()
            const data: OnMediaFolderImportedEventData = {
              type: type,
              folderPathInPlatformFormat: selectedFile.path,
              traceId: traceId,
            }

            document.dispatchEvent(new CustomEvent(UI_MediaFolderImportedEvent, { detail: data }))
          }, selectedFile.path)
        }
      })
    } else {
      openFilePicker((file: FileItem) => {
        openOpenFolder((type: FolderType) => {
          const traceId = `AppV2:UserOpenFolder:` + nextTraceId()
          const data: OnMediaFolderImportedEventData = {
            type: type,
            folderPathInPlatformFormat: file.path,
            traceId: traceId,
          }

          document.dispatchEvent(new CustomEvent(UI_MediaFolderImportedEvent, { detail: data }))
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
              traceId: `AppV2:UserOpenMediaLibrary:${nextTraceId()}`,
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
            traceId: `AppV2:UserOpenMediaLibrary:${nextTraceId()}`,
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

      const traceId = `AppV2-onDeleteSelected-${nextTraceId()}`
      const deletedPosix = new Set(paths.map((p) => Path.posix(p)))
      const deletedNative = new Set(paths)

      const getMediaMetadata = (path: string): UIMediaMetadata | undefined => {
        const normalized = normalizeMediaFolderPathForQuery(path)
        if (!normalized) return undefined
        return queryClient.getQueryData<UIMediaMetadata>(mediaMetadataQueryKey(normalized))
      }

      // Snapshot for rollback
      const removedMetadataByPath = paths
        .map((p) => getMediaMetadata(p))
      const removedMetadata = removedMetadataByPath.filter((m): m is NonNullable<typeof m> => m != null)
      const previousFolders = userConfig.folders
      const previousUiFolders = [...useUIMediaFolderStore.getState().folders]
      const prevUiSelection = {
        selectedFolder: useUIMediaFolderStore.getState().selectedFolder,
        selectedFolders: [...useUIMediaFolderStore.getState().selectedFolders],
      }

      // 1. Optimistic: remove all selected from UI state at once
      paths.forEach((path) => {
        const normalized = normalizeMediaFolderPathForQuery(path)
        if (normalized) {
          queryClient.removeQueries({ queryKey: mediaMetadataQueryKey(normalized), exact: true })
        }
      })
      const newFolders = userConfig.folders
        .filter((f) => isNotNil(f))
        .filter((folder) => !deletedPosix.has(Path.posix(folder)))
      setAndSaveUserConfig(traceId, { ...userConfig, folders: newFolders })

      const st = useUIMediaFolderStore.getState()
      const nextUiFolders = st.folders.filter((folder) => !deletedPosix.has(Path.posix(folder.path)))
      const nextSelectedFolders = st.selectedFolders.filter((p) => !deletedNative.has(p))
      let nextPrimary = st.selectedFolder
      if (deletedNative.has(nextPrimary)) {
        nextPrimary = newFolders[0] ? Path.toPlatformPath(newFolders[0]) : ""
      }
      useUIMediaFolderStore.setState({
        folders: nextUiFolders,
        selectedFolders:
          nextSelectedFolders.length > 0
            ? nextSelectedFolders
            : nextPrimary
              ? [nextPrimary]
              : [],
        selectedFolder: nextPrimary,
      })

      // 2. Async delete; rollback on failure
      try {
        await Promise.all(paths.map((path) => mediaMetadataRepository.delete(path, { traceId })))
      } catch (error) {
        console.error("[onDeleteSelected] Failed to delete some media metadata:", error)
        removedMetadata.forEach((metadata) => {
          const folder = normalizeMediaFolderPathForQuery(metadata.mediaFolderPath || "")
          if (folder) {
            queryClient.setQueryData(mediaMetadataQueryKey(folder), metadata)
          }
        })
        setAndSaveUserConfig(traceId, { ...userConfig, folders: previousFolders })
        useUIMediaFolderStore.setState({
          folders: previousUiFolders,
          selectedFolder: prevUiSelection.selectedFolder,
          selectedFolders: prevUiSelection.selectedFolders,
        })
        toast.error(
          error instanceof Error ? error.message : "Failed to delete selected folders. Changes reverted."
        )
      }
    },
    [
      userConfig,
      setAndSaveUserConfig,
      queryClient,
    ]
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
                  viewMode={viewMode}
                  onViewModeChange={setViewMode}
                  viewSwitcherDisabled={
                    uiFolders.length === 0 ||
                    !selectedMediaMetadata ||
                    folderStatus === "folder_not_found"
                  }
                  onToggleAIArea={isAiAreaEnabled ? handleToggleAIArea : undefined}
                  isAIAreaCollapsed={isAIAreaCollapsed}
                />
              </div>
              {/* Sidebar | Content */}
              <div className="flex-1 min-h-0">
                <ResizablePanelGroup direction="horizontal">
                  {/* Sidebar */}
                  <ResizablePanel defaultSize={20} minSize={15} maxSize={45}>
                    <div className="min-w-0 overflow-hidden border-r border-border bg-muted/30 h-full">
                      <Sidebar onDeleteSelected={onDeleteSelected} />
                    </div>
                  </ResizablePanel>
                  <ResizableHandle withHandle />
                  {/* Content */}
                  <ResizablePanel>
                    <div className="flex flex-col overflow-hidden bg-background h-full">
                      {uiFolders.length === 0 && (
                        <div style={{ padding: "20px", overflow: "auto" }}>
                          <Welcome onImportFolderClick={handleOpenFolderMenuClick} />
                        </div>
                      )}
                      {uiFolders.length > 0 && selectedFolder && folderStatus === "folder_not_found" && (
                        <FolderNotAvailablePanel />
                      )}
                      {uiFolders.length > 0 && folderStatus !== "folder_not_found" && selectedMediaMetadata && (
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
                              {selectedMediaMetadata.type !== "tvshow-folder" 
                              && selectedMediaMetadata.type !== "movie-folder"
                              && selectedMediaMetadata.type !== "music-folder" 
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
      <Toaster position="bottom-right" />
    </div>
  )
}

export default function AppV2() {
  return (
      <AppV2Content />
  )
}

