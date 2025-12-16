import { createContext, useContext, useState, useCallback, type ReactNode, useEffect, useMemo } from "react"
import type { MediaMetadata } from "@core/types"
import { readMediaMetadataApi } from "@/api/readMediaMatadata"
import { useConfig } from "./config-provider"
import { writeMediaMetadata } from "@/api/writeMediaMatadata"
import { deleteMediaMetadata } from "@/api/deleteMediaMetadata"

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
  }, [])

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

  useEffect(() => {
    userConfig.folders.map((path) => {
      readMediaMetadataApi(path).then((response) => {
        if (response.data && !response.error) {
          _addMediaMetadata(response.data)
        }
      }).catch((error) => {
        console.error("Failed to read media metadata:", error)
      })
    })
  }, [userConfig, _addMediaMetadata])

  const value: MediaMetadataContextValue = {
    mediaMetadatas,
    addMediaMetadata,
    updateMediaMetadata,
    removeMediaMetadata,
    getMediaMetadata,
    selectedMediaMetadata,
    setSelectedMediaMetadata
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

