import { useState, useEffect, useMemo } from "react"
import { FileExplorer } from "@/components/FileExplorer"
import type { FileItem } from "@/components/dialogs/types"
import { useMediaMetadata } from "@/providers/media-metadata-provider"
import { nextTraceId } from "@/lib/utils"
import { Path } from "@core/path"
import { extractUIMediaMetadataProps, type UIMediaMetadata } from "@/types/UIMediaMetadata"
import { UnknownMediaTypeWarning, type MediaType } from "@/components/UnknownMediaTypeWarning"

export interface LocalFilePanelProps {
  mediaFolderPath?: string
}

export function LocalFilePanel({ mediaFolderPath }: LocalFilePanelProps) {
  const { updateMediaMetadata, selectedMediaMetadata } = useMediaMetadata()
  const [mediaType, setMediaType] = useState<MediaType>("unknown")
  const [currentPath, setCurrentPath] = useState<string>(mediaFolderPath || "~")
  const [selectedFile, setSelectedFile] = useState<FileItem | null>(null)

  // Initialize mediaType from existing metadata
  useEffect(() => {
    if (selectedMediaMetadata?.type) {
      // Convert MediaMetadata.type to MediaType
      if (selectedMediaMetadata.type === "tvshow-folder") {
        setMediaType("tvshow")
      } else if (selectedMediaMetadata.type === "movie-folder") {
        setMediaType("movie")
      } else if (selectedMediaMetadata.type === "music-folder") {
        setMediaType("music")
      } else {
        setMediaType("unknown")
      }
    } else {
      setMediaType("unknown")
    }
  }, [selectedMediaMetadata])

  // Update current path when mediaFolderPath changes
  useEffect(() => {
    if (mediaFolderPath) {
      setCurrentPath(mediaFolderPath)
    }
  }, [mediaFolderPath])

  // Handle confirm button click
  const handleConfirm = () => {
    if (!selectedMediaMetadata?.mediaFolderPath) {
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


    const traceId = `LocalFilePanel-handleConfirm-${nextTraceId()}`
    updateMediaMetadata(selectedMediaMetadata.mediaFolderPath!, (prev) => {
      return {
        ...prev,
        type: metadataType,
        ...extractUIMediaMetadataProps(prev),
      }
    }, { traceId })
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
      {mediaType === "unknown" && selectedMediaMetadata?.status === 'ok' && (
        <UnknownMediaTypeWarning
          mediaType={mediaType}
          onMediaTypeChange={setMediaType}
          onConfirm={handleConfirm}
          disabled={!selectedMediaMetadata?.mediaFolderPath}
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

