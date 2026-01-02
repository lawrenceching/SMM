import { useState, useEffect } from "react"
import { Search } from "lucide-react"
import { FileExplorer } from "@/components/FileExplorer"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import type { FileItem } from "@/components/dialogs/types"

export type MediaType = "tvshow" | "movie" | "music" | "unknown"

export interface LocalFilePanelProps {
  mediaFolderPath?: string
}

export function LocalFilePanel({ mediaFolderPath }: LocalFilePanelProps) {
  const [mediaType, setMediaType] = useState<MediaType>("unknown")
  const [currentPath, setCurrentPath] = useState<string>(mediaFolderPath || "~")
  const [selectedFile, setSelectedFile] = useState<FileItem | null>(null)

  // Update current path when mediaFolderPath changes
  useEffect(() => {
    if (mediaFolderPath) {
      setCurrentPath(mediaFolderPath)
    }
  }, [mediaFolderPath])

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
      {/* 工具栏 */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          padding: "8px 12px",
          borderBottom: "1px solid #d0d0d0",
          backgroundColor: "#f8f8f8",
        }}
      >
        {/* 媒体类型选择 */}
        <Select value={mediaType} onValueChange={(value) => setMediaType(value as MediaType)}>
          <SelectTrigger
            style={{
              width: "120px",
              height: "32px",
            }}
          >
            <SelectValue placeholder="类型" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="tvshow">电视剧</SelectItem>
            <SelectItem value="movie">电影</SelectItem>
            <SelectItem value="music">音乐</SelectItem>
            <SelectItem value="unknown">未知</SelectItem>
          </SelectContent>
        </Select>

        {/* 搜索按钮 */}
        <Button
          
          size="sm"
          style={{
            height: "32px",
            padding: "0 12px",
          }}
        >
          <Search className="h-4 w-4" />
        </Button>
      </div>

      {/* 文件列表 */}
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

