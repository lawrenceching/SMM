import { useState, useEffect } from "react"
import { AlertTriangle, Check } from "lucide-react"
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
      {/* 警告栏 */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "12px",
          padding: "10px 12px",
          borderBottom: "1px solid #fbbf24",
          backgroundColor: "#fef3c7",
        }}
      >
        {/* 媒体类型选择 */}
        <div
          style={{
            backgroundColor: "#ffffff",
            borderRadius: "6px",
            padding: "2px",
            boxShadow: "0 1px 2px 0 rgba(0, 0, 0, 0.05)",
          }}
        >
          <Select value={mediaType} onValueChange={(value) => setMediaType(value as MediaType)}>
            <SelectTrigger
              style={{
                width: "120px",
                height: "32px",
                border: "none",
                boxShadow: "none",
              }}
            >
              <SelectValue placeholder="类型" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="tvshow">电视剧</SelectItem>
              <SelectItem value="movie">电影</SelectItem>
              <SelectItem value="music">音乐</SelectItem>
              <SelectItem value="unknown">选择类型...</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* 警告消息 */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            flex: 1,
            color: "#92400e",
            fontSize: "14px",
            fontWeight: 500,
          }}
        >
          <AlertTriangle className="h-4 w-4" style={{ flexShrink: 0 }} />
          <span>请选择媒体类型</span>
        </div>

        {/* 确认按钮 */}
        <Button
          size="sm"
          style={{
            height: "32px",
            padding: "0 16px",
            backgroundColor: "#f59e0b",
            color: "#ffffff",
            fontWeight: 500,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = "#d97706"
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = "#f59e0b"
          }}
        >
          <Check className="h-4 w-4 mr-2" />
          确认
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

