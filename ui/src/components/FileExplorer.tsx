import { useState, useCallback, useEffect } from "react"
import { Loader2, File, FolderOpen } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"
import { listFilesApi } from "@/api/listFiles"
import type { FileItem } from "@/components/dialogs/types"

export interface FileExplorerProps {
  currentPath: string
  onPathChange: (path: string) => void
  selectedFile: FileItem | null
  onFileSelect: (file: FileItem | null) => void
  onFileDoubleClick?: (file: FileItem) => void
  initialPath?: string
  className?: string
  showPathBar?: boolean
}

export function FileExplorer({
  currentPath,
  onPathChange,
  selectedFile,
  onFileSelect,
  onFileDoubleClick,
  initialPath = "~",
  className,
  showPathBar = true,
}: FileExplorerProps) {
  const [files, setFiles] = useState<FileItem[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pathHistory, setPathHistory] = useState<string[]>([initialPath])

  const loadFiles = useCallback(async (path: string) => {
    setIsLoading(true)
    setError(null)
    try {
      // Make two API calls: one for folders, one for files
      const [foldersResponse, filesResponse] = await Promise.all([
        listFilesApi(path, {
          onlyFolders: true,
          includeHiddenFiles: false,
        }),
        listFilesApi(path, {
          onlyFiles: true,
          includeHiddenFiles: false,
        }),
      ])
      
      if (foldersResponse.error || filesResponse.error) {
        setError(foldersResponse.error || filesResponse.error || 'Failed to load files')
        setFiles([])
      } else {
        // Convert folders to FileItem format
        const folders: FileItem[] = foldersResponse.data.map((filePath) => {
          const pathParts = filePath.split(/[/\\]/)
          const name = pathParts[pathParts.length - 1] || filePath
          return {
            name,
            path: filePath,
            isDirectory: true,
          }
        })

        // Convert files to FileItem format
        const files: FileItem[] = filesResponse.data.map((filePath) => {
          const pathParts = filePath.split(/[/\\]/)
          const name = pathParts[pathParts.length - 1] || filePath
          return {
            name,
            path: filePath,
            isDirectory: false,
          }
        })

        // Sort: folders first, then files, both alphabetically
        const sortedFolders = folders.sort((a, b) => a.name.localeCompare(b.name))
        const sortedFiles = files.sort((a, b) => a.name.localeCompare(b.name))
        
        setFiles([...sortedFolders, ...sortedFiles])
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load files')
      setFiles([])
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Load files when path changes
  useEffect(() => {
    loadFiles(currentPath)
  }, [currentPath, loadFiles])

  // Initialize path history when initialPath changes
  useEffect(() => {
    if (currentPath === initialPath && pathHistory.length === 0) {
      setPathHistory([initialPath])
    }
  }, [currentPath, initialPath, pathHistory.length])

  const handleItemClick = (file: FileItem) => {
    // Single-click: select file or folder
    onFileSelect(file)
  }

  const handleItemDoubleClick = (file: FileItem) => {
    // Double-click: navigate into folder
    if (file.isDirectory) {
      const newHistory = [...pathHistory, currentPath]
      setPathHistory(newHistory)
      onPathChange(file.path)
      onFileSelect(null)
    }
    // Call optional double click handler
    onFileDoubleClick?.(file)
  }

  const handleGoBack = () => {
    if (pathHistory.length > 1) {
      const newHistory = [...pathHistory]
      newHistory.pop() // Remove current path
      const previousPath = newHistory[newHistory.length - 1]
      setPathHistory(newHistory)
      onPathChange(previousPath)
      onFileSelect(null)
    }
  }

  return (
    <div className={cn("flex flex-col gap-2 overflow-hidden", className)}>
      {/* Current path and navigation */}
      {showPathBar && (
        <div className="flex items-center gap-2 min-w-0">
          {pathHistory.length > 1 && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleGoBack}
              disabled={isLoading}
              className="shrink-0"
            >
              ← Back
            </Button>
          )}
          <div className="flex-1 text-sm text-muted-foreground truncate min-w-0">
            {currentPath}
          </div>
        </div>
      )}
      
      {/* File list */}
      <div className="flex-1 w-full rounded-md border overflow-hidden relative" style={{ minHeight: 0 }}>
        <style>{`
          .file-explorer-scroll-container [data-slot="scroll-area-viewport"] {
            display: block !important;
            width: 100% !important;
            max-width: 100% !important;
            min-width: 0 !important;
            table-layout: auto !important;
          }
        `}</style>
        <ScrollArea className="h-full w-full file-explorer-scroll-container" style={{ height: "100%" }}>
          <div className="p-4 w-full max-w-full box-border">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : error ? (
              <div className="flex items-center justify-center py-8 text-sm text-destructive">
                {error}
              </div>
            ) : files.length === 0 ? (
              <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
                No files or folders found
              </div>
            ) : (
              <div className="flex flex-col gap-1 w-full max-w-full box-border">
                {files.map((file) => (
                  <div
                    key={file.path}
                    onClick={() => handleItemClick(file)}
                    onDoubleClick={() => handleItemDoubleClick(file)}
                    className={cn(
                      "flex items-center gap-3 p-3 rounded-md cursor-pointer transition-colors",
                      "hover:bg-accent hover:text-accent-foreground",
                      selectedFile?.path === file.path && "bg-primary/10 ring-2 ring-primary ring-inset"
                    )}
                    style={{ width: '100%', maxWidth: '100%', boxSizing: 'border-box', minWidth: 0 }}
                  >
                    {file.isDirectory ? (
                      <FolderOpen className="h-4 w-4 shrink-0" />
                    ) : (
                      <File className="h-4 w-4 shrink-0" />
                    )}
                    <div className="flex flex-col flex-1 overflow-hidden" style={{ minWidth: 0, maxWidth: '100%' }}>
                      <span className="font-medium truncate">{file.name}</span>
                      <span className="text-xs text-muted-foreground truncate">{file.path}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  )
}

