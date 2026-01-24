import { useState, useEffect, useMemo } from "react"
import { FileExplorer } from "@/components/FileExplorer"
import type { FileItem } from "@/components/dialogs/types"
import { useMediaMetadata } from "@/providers/media-metadata-provider"
import { Path } from "@core/path"
import type { MediaMetadata } from "@core/types"
import { UnknownMediaTypeWarning, type MediaType } from "@/components/UnknownMediaTypeWarning"

export interface LocalFilePanelProps {
  mediaFolderPath?: string
}

export function LocalFilePanel({ mediaFolderPath }: LocalFilePanelProps) {
  const { getMediaMetadata, updateMediaMetadata } = useMediaMetadata()
  const [mediaType, setMediaType] = useState<MediaType>("unknown")
  const [currentPath, setCurrentPath] = useState<string>(mediaFolderPath || "~")
  const [selectedFile, setSelectedFile] = useState<FileItem | null>(null)

  // Convert mediaFolderPath to POSIX format for metadata lookup
  const mediaFolderPathInPosix = useMemo(() => {
    if (!mediaFolderPath) return undefined
    return Path.posix(mediaFolderPath)
  }, [mediaFolderPath])

  // Get current media metadata
  const currentMediaMetadata = useMemo(() => {
    if (!mediaFolderPathInPosix) return undefined
    return getMediaMetadata(mediaFolderPathInPosix)
  }, [mediaFolderPathInPosix, getMediaMetadata])

  // Initialize mediaType from existing metadata
  useEffect(() => {
    if (currentMediaMetadata?.type) {
      // Convert MediaMetadata.type to MediaType
      if (currentMediaMetadata.type === "tvshow-folder") {
        setMediaType("tvshow")
      } else if (currentMediaMetadata.type === "movie-folder") {
        setMediaType("movie")
      } else if (currentMediaMetadata.type === "music-folder") {
        setMediaType("music")
      } else {
        setMediaType("unknown")
      }
    } else {
      setMediaType("unknown")
    }
  }, [currentMediaMetadata])

  // Update current path when mediaFolderPath changes
  useEffect(() => {
    if (mediaFolderPath) {
      setCurrentPath(mediaFolderPath)
    }
  }, [mediaFolderPath])

  // Handle confirm button click
  const handleConfirm = () => {
    if (!mediaFolderPathInPosix) {
      console.warn("[LocalFilePanel] Cannot update media metadata: missing path")
      return
    }

    if (mediaType === "unknown") {
      console.warn("[LocalFilePanel] Cannot update media metadata: media type is unknown")
      return
    }

    // Convert MediaType to MediaMetadata.type
    let metadataType: "tvshow-folder" | "movie-folder" | "music-folder" | undefined
    if (mediaType === "tvshow") {
      metadataType = "tvshow-folder"
    } else if (mediaType === "movie") {
      metadataType = "movie-folder"
    } else if (mediaType === "music") {
      metadataType = "music-folder"
    }

    // Update or create media metadata
    const updatedMetadata: MediaMetadata = {
      ...(currentMediaMetadata || {}),
      type: metadataType,
      mediaFolderPath: mediaFolderPathInPosix,
    }

    updateMediaMetadata(mediaFolderPathInPosix, updatedMetadata)
    console.log(`[LocalFilePanel] Updated media type to: ${metadataType}`)
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        width: "100%",
        backgroundColor: "#ffffff",
      }}
    >
      {/* Warning bar - only shown when media type is unknown */}
      {mediaType === "unknown" && (
        <UnknownMediaTypeWarning
          mediaType={mediaType}
          onMediaTypeChange={setMediaType}
          onConfirm={handleConfirm}
          disabled={!mediaFolderPathInPosix}
        />
      )}

      {/* File list */}
      <div
        style={{
          flex: 1,
          overflow: "hidden",
          padding: "12px",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <FileExplorer
          currentPath={currentPath}
          onPathChange={setCurrentPath}
          selectedFile={selectedFile}
          onFileSelect={setSelectedFile}
          initialPath={mediaFolderPath || "~"}
          showPathBar={true}
          className="flex-1"
        />
      </div>
    </div>
  )
}

