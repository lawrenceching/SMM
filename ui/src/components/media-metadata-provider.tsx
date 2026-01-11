import { createContext, useContext, useState, useCallback, type ReactNode, useEffect, useMemo } from "react"
import type { MediaMetadata } from "@core/types"
import { useConfig } from "./config-provider"
import { deleteMediaMetadata } from "@/api/deleteMediaMetadata"
import localStorages from "@/lib/localStorages"
import { readMediaMetadataV2 } from "@/api/readMediaMetadataV2"
import { Path } from "@core/path"
import { writeMediaMetadata } from "@/api/writeMediaMetadata"

interface MediaMetadataContextValue {
  mediaMetadatas: MediaMetadata[]
  addMediaMetadata: (metadata: MediaMetadata) => void
  updateMediaMetadata: (path: string, metadata: MediaMetadata) => void
  /**
   * @param path POSIX
   * @returns 
   */
  removeMediaMetadata: (path: string) => void
  getMediaMetadata: (path: string) => MediaMetadata | undefined
  selectedMediaMetadata: MediaMetadata | undefined
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
  reloadMediaMetadatas: () => Promise<void>
}

const MediaMetadataContext = createContext<MediaMetadataContextValue | undefined>(undefined)

interface MediaMetadataProviderProps {
  children: ReactNode
  initialMediaMetadatas?: MediaMetadata[]
}



export function MediaMetadataProvider({
  children,
  initialMediaMetadatas = [],
}: MediaMetadataProviderProps) {
  const [mediaMetadatas, setMediaMetadatas] = useState<MediaMetadata[]>(initialMediaMetadatas)
  const [selectedIndex, setSelectedIndex] = useState<number>(0)
  const { userConfig } = useConfig()
  const selectedMediaMetadata: MediaMetadata | undefined = useMemo(() => {
    if (selectedIndex < 0 || selectedIndex >= mediaMetadatas.length) {
      return undefined
    }

    return mediaMetadatas[selectedIndex]
  }, [mediaMetadatas, selectedIndex])

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
   * Internal function to add media metadata to the list.
   * It will check if the metadata already exists in the list, if it does, it will update the metadata, otherwise it will add the metadata to the list.
   */
  const _addMediaMetadata = useCallback((metadata: MediaMetadata) => {
    setMediaMetadatas((prev) => {
      // Check if metadata with the same path already exists
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

  const addMediaMetadata = useCallback((metadata: MediaMetadata) => {
    writeMediaMetadata(metadata)
      .then(() => {
        _addMediaMetadata(metadata)
        console.log("Media metadata written successfully")
      })
      .catch((error) => {
        console.error("Failed to write media metadata:", error)
      })
  }, [_addMediaMetadata])

  const updateMediaMetadata = useCallback((path: string, metadata: MediaMetadata) => {
    // Ensure metadata.mediaFolderPath is set to the provided path if not already set
    const metadataToUpdate: MediaMetadata = {
      ...metadata,
      mediaFolderPath: metadata.mediaFolderPath || path
    }
    
    writeMediaMetadata(metadataToUpdate)
      .then(() => {
        _addMediaMetadata(metadataToUpdate)
        console.log("Media metadata updated successfully")
      })
      .catch((error) => {
        console.error("Failed to update media metadata:", error)
      })
  }, [_addMediaMetadata])

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
    readMediaMetadataV2(path)
      .then((response) => {
        _addMediaMetadata(response)
      })
      .catch((error) => {
        console.error(`[MediaMetadataProvider] Error refreshing media metadata for ${path}:`, error)
      })
  }, [_addMediaMetadata])

  const reloadMediaMetadatas = useCallback(async () => {
    console.log('[MediaMetadataProvider] Reloading media metadata', userConfig.folders)
    const promises = userConfig.folders.map((path) => readMediaMetadataV2(Path.posix(path)))
    const responses = await Promise.all(promises)
    const mediaMetadatas: MediaMetadata[] = responses

    console.log('[MediaMetadataProvider] Reloaded media metadata', mediaMetadatas)
    setMediaMetadatas(mediaMetadatas)
  }, [userConfig])

  useEffect(() => {
    reloadMediaMetadatas()
  }, [userConfig, _addMediaMetadata])

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
    reloadMediaMetadatas
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

