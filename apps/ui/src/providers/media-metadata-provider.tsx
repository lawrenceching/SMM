import { createContext, useContext, useState, useCallback, type ReactNode, useEffect, useMemo } from "react"
import { extractUIMediaMetadataProps, type UIMediaMetadata } from "@/types/UIMediaMetadata"
import { useConfig } from "./config-provider"
import { deleteMediaMetadata } from "@/api/deleteMediaMetadata"
import localStorages from "@/lib/localStorages"
import { readMediaMetadataV2 } from "@/api/readMediaMetadataV2"
import { nextTraceId } from "@/lib/utils"
import { Path } from "@core/path"
import { writeMediaMetadata } from "@/api/writeMediaMetadata"
import type { MediaMetadata } from "@core/types"
import { useLatest } from "react-use"
import { minimize } from "@/lib/log"

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
  setSelectedMediaMetadata: (index: number) => void
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

/**
 * Compares two UIMediaMetadata objects to determine if core MediaMetadata properties have changed.
 * UI-specific properties (like 'status') are excluded from the comparison.
 * @returns true if any MediaMetadata property has changed, false if only UI properties changed
 */
function hasMediaMetadataChanged(
  current: UIMediaMetadata | undefined,
  updated: UIMediaMetadata
): boolean {
  // If there's no current metadata, consider it as changed (needs to be written)
  if (!current) {
    return true
  }

  // Keys that are UI-specific and should not trigger a file write
  const uiOnlyKeys: (keyof UIMediaMetadata)[] = ['status']

  // Compare all keys in the updated object
  for (const key of Object.keys(updated) as (keyof UIMediaMetadata)[]) {
    // Skip UI-only keys
    if (uiOnlyKeys.includes(key)) {
      continue
    }

    const currentValue = current[key]
    const updatedValue = updated[key]

    // Handle arrays (e.g., mediaFiles, seasons)
    if (Array.isArray(currentValue) && Array.isArray(updatedValue)) {
      if (JSON.stringify(currentValue) !== JSON.stringify(updatedValue)) {
        return true
      }
    } else if (currentValue !== updatedValue) {
      // Handle null/undefined/primitive value differences
      return true
    }
  }

  return false
}

interface MediaMetadataProviderProps {
  children: ReactNode
  initialMediaMetadatas?: UIMediaMetadata[]
}

const debug: boolean = true;

export function MediaMetadataProvider({
  children,
  initialMediaMetadatas = [],
}: MediaMetadataProviderProps) {
  const [mediaMetadatas, setMediaMetadatas] = useState<UIMediaMetadata[]>(initialMediaMetadatas)
  const latestMediaMetadatas = useLatest(mediaMetadatas)
  const [selectedIndex, setSelectedIndex] = useState<number>(0)
  const { userConfig } = useConfig()
  const selectedMediaMetadata: UIMediaMetadata | undefined = useMemo(() => {
    if (selectedIndex < 0 || selectedIndex >= mediaMetadatas.length) {
      return undefined
    }

    return mediaMetadatas[selectedIndex]
  }, [mediaMetadatas, selectedIndex])

  if(debug) {
    useEffect(() => {
      console.log(`[MediaMetadataProvider] mediaMetadatas: `, mediaMetadatas)
    }, [mediaMetadatas])
  }
  

  const setSelectedMediaMetadata = useCallback((index: number) => {
    setSelectedIndex(index)
    localStorages.selectedFolderIndex = index
  }, [])

  const setSelectedMediaMetadataByMediaFolderPath = useCallback((path: string) => {
    const index = mediaMetadatas.findIndex((m) => m.mediaFolderPath === path)
    if (index >= 0) {
      console.log(`[MediaMetadataProvider] Set selected media metadata by media folder path: ${path}`, index)
      setSelectedIndex(index)
    } else {
      console.warn(`[MediaMetadataProvider] No media metadata found for path: ${path}`)
    }
  }, [mediaMetadatas])

  /**
   * Internal function to add/update media metadata to the list.
   * It will check if the metadata already exists in the list, if it does, it will update the metadata, otherwise it will add the metadata to the list.
   */
  const _addOrUpdateMediaMetadata = useCallback((metadata: UIMediaMetadata) => {
    setMediaMetadatas((prev) => {
      // Check if metadata with the same path already exists
      console.log(`[MediaMetadataProvider] finding media metadata`, {
        prev: prev,
        current: metadata,
      })
      const existingIndex = prev.findIndex(
        (m) => m.mediaFolderPath === metadata.mediaFolderPath
      )

      if (existingIndex >= 0) {
        // Update existing metadata
        const updated = [...prev]
        updated[existingIndex] = metadata
        return updated
      }
      // Add new metadata
      return [...prev, metadata]
    })
  }, [])

  const addMediaMetadata = useCallback((metadata: UIMediaMetadata, { traceId }: { traceId?: string} = {}) => {
    writeMediaMetadata(metadata, { traceId })
      .then(() => {
        _addOrUpdateMediaMetadata(metadata)
        console.log(`[addMediaMetadata][${traceId ? ` [${traceId}]` : ''}] Media metadata written successfully`)
      })
      .catch((error) => {
        console.error(`[addMediaMetadata][${traceId ? ` [${traceId}]` : ''}] Failed to write media metadata:`, error)
      })
  }, [_addOrUpdateMediaMetadata])

  const updateMediaMetadata = useCallback((path: string, metadataOrCallback: UIMediaMetadata | ((current: UIMediaMetadata) => UIMediaMetadata), { traceId }: { traceId?: string} = {}) => {
    console.log(`[updateMediaMetadata][${traceId ? ` [${traceId}]` : ''}] Updating media metadata for ${path}`)

    // Get current metadata for callback case
    const currentMetadata = latestMediaMetadatas.current.find((m) => m.mediaFolderPath === path)

    // Determine the metadata to update
    let metadataToUpdate: UIMediaMetadata
    if (typeof metadataOrCallback === 'function') {
      // Callback case: apply the callback to get the new metadata
      if (!currentMetadata) {
        console.error(`[updateMediaMetadata] No existing metadata found for path: ${path}`)
        return
      }
      metadataToUpdate = metadataOrCallback(currentMetadata)
    } else {
      // Direct object case: use the provided metadata
      metadataToUpdate = metadataOrCallback
    }

    // Ensure metadata.mediaFolderPath is set to the provided path if not already set
    metadataToUpdate = {
      ...metadataToUpdate,
      mediaFolderPath: metadataToUpdate.mediaFolderPath || path
    }

    // Compare currentMetadata and metadataToUpdate to determine if we need to persist to file
    const mediaMetadataChanged = hasMediaMetadataChanged(currentMetadata, metadataToUpdate)

    if (!mediaMetadataChanged) {
      // Only UI properties (like status) were updated, no need to write to file
      console.log(`[updateMediaMetadata][${traceId ? ` [${traceId}]` : ''}] Only UI properties updated, skipping file write`)
      _addOrUpdateMediaMetadata(metadataToUpdate)
      return
    }

    // MediaMetadata properties were updated, persist to file and update UI state
    console.log(`[updateMediaMetadata][${traceId ? ` [${traceId}]` : ''}] write media metadata file: ${path}`, minimize(metadataToUpdate))
    writeMediaMetadata(metadataToUpdate, { traceId })
      .then(() => {
        _addOrUpdateMediaMetadata(metadataToUpdate)
        console.log("Media metadata updated successfully", minimize(metadataToUpdate))
      })
      .catch((error) => {
        console.error("Failed to update media metadata:", error)
      })
  }, [_addOrUpdateMediaMetadata])


  const removeMediaMetadata = useCallback((path: string) => {
    deleteMediaMetadata(path)
      .then(() => {
        setMediaMetadatas((prev) =>
          prev.filter((m) => m.mediaFolderPath !== path)
        )
        console.log("Media metadata deleted successfully")
      })
      .catch((error) => {
        console.error("Failed to delete media metadata:", error)
      })
  }, [])

  const getMediaMetadata = useCallback(
    (path: string) => {
      return mediaMetadatas.find((m) => m.mediaFolderPath === path)
    },
    [mediaMetadatas]
  )

  const refreshMediaMetadata = useCallback((path: string) => {
    const traceId = `MediaMetadataProvider-refreshMediaMetadata-${nextTraceId()}`
    readMediaMetadataV2(path, { traceId })
      .then((response) => {
        _addOrUpdateMediaMetadata({ ...response, status: 'idle' })
      })
      .catch((error) => {
        console.error(`[MediaMetadataProvider]${traceId ? ` [${traceId}]` : ''} Error refreshing media metadata for ${path}:`, error)
      })
  }, [_addOrUpdateMediaMetadata])

  const reloadMediaMetadatas = useCallback(async ({ traceId }: { traceId?: string } = {}) => {
    console.log(`[MediaMetadataProvider]${traceId ? ` [${traceId}]` : ''} Reloading media metadata`, userConfig.folders)
    const promises = userConfig.folders.map((path) => {
      const folderPathInPosix = Path.posix(path)
      const currentMediaMetadata = latestMediaMetadatas.current.find((m) => m.mediaFolderPath === folderPathInPosix)
      if(!currentMediaMetadata) {
        return
      }
      readMediaMetadataV2(folderPathInPosix, { traceId })
        .then((mediaMetadataInResponse: MediaMetadata) => {
          _addOrUpdateMediaMetadata({ 
            ...mediaMetadataInResponse, 
            ...extractUIMediaMetadataProps(currentMediaMetadata) 
          })
        })
        .catch((error) => {
          console.error(`[MediaMetadataProvider]${traceId ? ` [${traceId}]` : ''} Error refreshing media metadata for ${path}:`, error)
        })
    })

    await Promise.all(promises)
    
  }, [userConfig, updateMediaMetadata])

  const updateMediaMetadataStatus = useCallback((folderPath: string, status: UIMediaMetadata['status']) => {
    setMediaMetadatas((prev) => {
      const index = prev.findIndex((m) => m.mediaFolderPath === folderPath)
      if (index < 0) {
        console.warn(`[MediaMetadataProvider] No media metadata found for path: ${folderPath}`)
        return prev
      }
      const updated = [...prev]
      updated[index] = { ...updated[index], status }
      return updated
    })
  }, [])

  const value: MediaMetadataContextValue = {
    mediaMetadatas,
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
    setMediaMetadatas
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
