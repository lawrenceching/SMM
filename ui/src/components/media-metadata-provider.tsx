import { createContext, useContext, useState, useCallback, type ReactNode, useEffect, useMemo } from "react"
import type { MediaMetadata } from "@core/types"
import { readMediaMetadataApi } from "@/api/readMediaMatadata"
import { useConfig } from "./config-provider"
import { writeMediaMetadata } from "@/api/writeMediaMatadata"

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
  const { userConfig, appConfig } = useConfig()
  const selectedMediaMetadata: MediaMetadata | undefined = useMemo(() => {
    if (selectedIndex < 0 || selectedIndex >= mediaMetadatas.length) {
      return undefined
    }

    return mediaMetadatas[selectedIndex]
  }, [mediaMetadatas, selectedIndex])

  const setSelectedMediaMetadata = useCallback((index: number) => {
    setSelectedIndex(index)
  }, [])

  const addMediaMetadata = useCallback((metadata: MediaMetadata) => {
    
    writeMediaMetadata(metadata)
      .then(() => {
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
        console.log("Media metadata written successfully")
      })
      .catch((error) => {
        console.error("Failed to write media metadata:", error)
      })
    
  }, [])

  const updateMediaMetadata = useCallback((path: string, metadata: MediaMetadata) => {
    setMediaMetadatas((prev) =>
      prev.map((m) => (m.mediaFolderPath === path ? metadata : m))
    )
  }, [])

  const removeMediaMetadata = useCallback((path: string) => {
    setMediaMetadatas((prev) =>
      prev.filter((m) => m.mediaFolderPath !== path)
    )
  }, [])

  const getMediaMetadata = useCallback(
    (path: string) => {
      return mediaMetadatas.find((m) => m.mediaFolderPath === path)
    },
    [mediaMetadatas]
  )

  useEffect(() => {

    userConfig.folders.map((path) => {
      readMediaMetadataApi(path).then((data) => {
        addMediaMetadata(data.data)
      })
    })
    
  }, [userConfig])

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

