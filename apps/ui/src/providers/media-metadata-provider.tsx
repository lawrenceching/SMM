/**
 * @deprecated Use zustand store and actions directly instead.
 * - State: useMediaMetadataStoreState() from "@/stores/mediaMetadataStore"
 * - Actions: useMediaMetadataStoreActions() from "@/stores/mediaMetadataStore"
 * - API + store updates: useMediaMetadataActions() from "@/actions/mediaMetadataActions"
 *
 * This provider is no longer mounted in the app. Components should use the store and
 * actions hooks directly (e.g. TvShowPanel, MoviePanel, MediaFolderImportedEventHandler).
 */
import { createContext, useContext, type ReactNode, useEffect, useCallback } from "react"
import type { UIMediaMetadata } from "@/types/UIMediaMetadata"
import { useConfig } from "./config-provider"
import { Path } from "@core/path"

// New architecture imports
import { useMediaMetadataStoreState, useMediaMetadataStoreActions } from "@/stores/mediaMetadataStore"
import { useMediaMetadataActions } from "@/actions/mediaMetadataActions"

interface MediaMetadataContextValue {
  mediaMetadatas: UIMediaMetadata[]
  setMediaMetadatas: (value: UIMediaMetadata[] | ((prev: UIMediaMetadata[]) => UIMediaMetadata[])) => void
  addMediaMetadata: (metadata: UIMediaMetadata, options?: { traceId?: string }) => void
  updateMediaMetadata: (path: string, metadata: UIMediaMetadata | ((current: UIMediaMetadata) => UIMediaMetadata), options?: { traceId?: string }) => void
  /**
   * @param path POSIX
   * @returns
   */
  removeMediaMetadata: (pathInPosix: string) => void
  getMediaMetadata: (pathInPosix: string) => UIMediaMetadata | undefined
  selectedMediaMetadata: UIMediaMetadata | undefined
  setSelectedMediaMetadata: (index: number, options?: { traceId?: string }) => void
  /**
   * Set selected media metadata by media folder path
   * @param path POSIX format folder path
   */
  setSelectedMediaMetadataByMediaFolderPath: (path: string) => void
  /**
   * Refresh media metadata from the server for a given folder path
   * @param path POSIX format folder path
   */
  refreshMediaMetadata: (path: string) => void
  /**
   * Reload all media metadata from the server for all folders in userConfig
   */
  reloadMediaMetadatas: (options?: { traceId?: string }) => Promise<void>
  /**
   * Update the status of a media metadata by folder path
   * @param folderPath POSIX format folder path
   * @param status The new status to set
   */
  updateMediaMetadataStatus: (folderPath: string, status: UIMediaMetadata['status']) => void
}

const MediaMetadataContext = createContext<MediaMetadataContextValue | undefined>(undefined)

interface MediaMetadataProviderProps {
  children: ReactNode
  initialMediaMetadatas?: UIMediaMetadata[]
}

/**
 * @deprecated See the comment at the beginning of this file for more details.
 * @param param0 
 * @returns 
 */
export function MediaMetadataProvider({
  children,
  initialMediaMetadatas = [],
}: MediaMetadataProviderProps) {
  // Initialize store with initial data
  const { mediaMetadatas, selectedMediaMetadata } = useMediaMetadataStoreState()
  const storeActions = useMediaMetadataStoreActions()
  const actions = useMediaMetadataActions()
  const { userConfig } = useConfig()

  // Sync store with initial data on mount / when initial list changes (including empty)
  useEffect(() => {
    storeActions.setMediaMetadatas(initialMediaMetadatas)
  }, [initialMediaMetadatas, storeActions])
  

  // Legacy compatibility methods - delegate to new store/actions
  const setSelectedMediaMetadata = useCallback((index: number, options?: { traceId?: string }) => {
    console.log(`${options?.traceId ? ` [${options.traceId}]` : ''} [MediaMetadataProvider] setSelectedMediaMetadata: index=${index}`)
    storeActions.setSelectedIndex(index)
  }, [storeActions])

  const setSelectedMediaMetadataByMediaFolderPath = useCallback((path: string) => {
    console.log(`[MediaMetadataProvider] Set selected media metadata by media folder path: ${path}`)
    storeActions.setSelectedByMediaFolderPath(path)
  }, [storeActions])

  const setMediaMetadatas = useCallback((value: UIMediaMetadata[] | ((prev: UIMediaMetadata[]) => UIMediaMetadata[])) => {
    if (typeof value === 'function') {
      const newValue = value(mediaMetadatas)
      storeActions.setMediaMetadatas(newValue)
    } else {
      storeActions.setMediaMetadatas(value)
    }
  }, [mediaMetadatas, storeActions])

  const addMediaMetadata = useCallback(async (metadata: UIMediaMetadata, { traceId }: { traceId?: string} = {}) => {
    try {
      await actions.saveMediaMetadata(metadata, { traceId })
    } catch (error) {
      console.error(`[addMediaMetadata][${traceId ? ` [${traceId}]` : ''}] Failed to add media metadata:`, error)
    }
  }, [actions])

  const updateMediaMetadata = useCallback(async (path: string, metadataOrCallback: UIMediaMetadata | ((current: UIMediaMetadata) => UIMediaMetadata), { traceId }: { traceId?: string} = {}) => {
    try {
      await actions.updateMediaMetadata(path, metadataOrCallback, { traceId })
    } catch (error) {
      console.error(`[updateMediaMetadata][${traceId ? ` [${traceId}]` : ''}] Failed to update media metadata:`, error)
    }
  }, [actions])

  const removeMediaMetadata = useCallback(async (path: string) => {
    try {
      await actions.deleteMediaMetadata(path)
    } catch (error) {
      console.error("Failed to remove media metadata:", error)
    }
  }, [actions])

  const getMediaMetadata = useCallback(
    (path: string) => storeActions.getMediaMetadata(path),
    [storeActions]
  )

  const refreshMediaMetadata = useCallback(async (path: string) => {
    try {
      await actions.refreshMediaMetadata(path)
    } catch (error) {
      console.error(`Error refreshing media metadata for ${path}:`, error)
    }
  }, [actions])

  const reloadMediaMetadatas = useCallback(async ({ traceId }: { traceId?: string } = {}) => {
    console.log(`[MediaMetadataProvider]${traceId ? ` [${traceId}]` : ''} Reloading media metadata`, userConfig.folders)
    const folderPathsInPosix = userConfig.folders.map(path => Path.posix(path))
    try {
      await actions.reloadAllMediaMetadata(folderPathsInPosix, { traceId })
    } catch (error) {
      console.error(`[MediaMetadataProvider]${traceId ? ` [${traceId}]` : ''} Error reloading media metadata:`, error)
    }
  }, [userConfig.folders, actions])

  const updateMediaMetadataStatus = useCallback((folderPath: string, status: UIMediaMetadata['status']) => {
    storeActions.updateMediaMetadataStatus(folderPath, status)
  }, [storeActions])

  const value: MediaMetadataContextValue = {
    mediaMetadatas,
    setMediaMetadatas,
    addMediaMetadata,
    updateMediaMetadata,
    removeMediaMetadata,
    getMediaMetadata,
    selectedMediaMetadata,
    setSelectedMediaMetadata,
    setSelectedMediaMetadataByMediaFolderPath,
    refreshMediaMetadata,
    reloadMediaMetadatas,
    updateMediaMetadataStatus,
  }

  return (
    <MediaMetadataContext.Provider value={value}>
      {children}
    </MediaMetadataContext.Provider>
  )
}

export function useMediaMetadata(): MediaMetadataContextValue {
  const context = useContext(MediaMetadataContext)
  if (context === undefined) {
    throw new Error("useMediaMetadata must be used within a MediaMetadataProvider")
  }
  return context
}
