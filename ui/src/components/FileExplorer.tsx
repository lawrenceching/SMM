import { useState, useCallback, useEffect, useMemo } from "react"
import { 
  Loader2, 
  File, 
  FolderOpen, 
  Home, 
  ChevronRight, 
  Search,
  X,
  FileText,
  FileVideo,
  FileAudio,
  FileImage,
  FileCode,
  FileArchive,
  Layers
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { listFilesApi } from "@/api/listFiles"
import type { FileItem } from "@/components/dialogs/types"

// Helper function to get file extension
function getFileExtension(filename: string): string {
  const parts = filename.split('.')
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : ''
}

// Helper function to get file icon based on extension
function getFileIcon(filename: string, isDirectory: boolean) {
  if (isDirectory) {
    return <FolderOpen className="h-5 w-5 text-blue-500" />
  }
  
  const ext = getFileExtension(filename)
  
  // Video files
  if (['mp4', 'mkv', 'avi', 'mov', 'wmv', 'flv', 'webm', 'm4v', 'mpg', 'mpeg'].includes(ext)) {
    return <FileVideo className="h-5 w-5 text-purple-500" />
  }
  
  // Audio files
  if (['mp3', 'wav', 'flac', 'aac', 'ogg', 'wma', 'm4a', 'opus'].includes(ext)) {
    return <FileAudio className="h-5 w-5 text-green-500" />
  }
  
  // Image files
  if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg', 'webp', 'ico', 'tiff'].includes(ext)) {
    return <FileImage className="h-5 w-5 text-pink-500" />
  }
  
  // Code files
  if (['js', 'ts', 'jsx', 'tsx', 'py', 'java', 'cpp', 'c', 'h', 'cs', 'go', 'rs', 'php', 'rb', 'swift'].includes(ext)) {
    return <FileCode className="h-5 w-5 text-yellow-500" />
  }
  
  // Archive files
  if (['zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz'].includes(ext)) {
    return <FileArchive className="h-5 w-5 text-orange-500" />
  }
  
  // Text/Document files
  if (['txt', 'md', 'pdf', 'doc', 'docx', 'rtf', 'odt'].includes(ext)) {
    return <FileText className="h-5 w-5 text-blue-400" />
  }
  
  // Subtitle files
  if (['srt', 'ass', 'ssa', 'sub', 'vtt'].includes(ext)) {
    return <Layers className="h-5 w-5 text-cyan-500" />
  }
  
  // Default
  return <File className="h-5 w-5 text-gray-400" />
}

// Helper function to get file type badge color
function getFileTypeBadge(filename: string, isDirectory: boolean): { label: string; color: string } | null {
  if (isDirectory) return null
  
  const ext = getFileExtension(filename)
  if (!ext) return null
  
  return { label: ext.toUpperCase(), color: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300' }
}

export interface FileExplorerProps {
  currentPath: string
  onPathChange: (path: string) => void
  selectedFile: FileItem | null
  onFileSelect: (file: FileItem | null) => void
  onFileDoubleClick?: (file: FileItem) => void
  initialPath?: string
  className?: string
  showPathBar?: boolean
  onlyFolders?: boolean
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
  onlyFolders = false,
}: FileExplorerProps) {
  const [files, setFiles] = useState<FileItem[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pathHistory, setPathHistory] = useState<string[]>([initialPath])
  const [searchQuery, setSearchQuery] = useState("")
  const [focusedIndex, setFocusedIndex] = useState<number>(-1)

  const loadFiles = useCallback(async (path: string) => {
    setIsLoading(true)
    setError(null)
    setSearchQuery("") // Clear search when loading new directory
    setFocusedIndex(-1) // Reset focus
    try {
      const response = await listFilesApi(path, {
        onlyFolders,
        includeHiddenFiles: false,
      })
      
      if (response.error) {
        setError(response.error || 'Failed to load files')
        setFiles([])
      } else {
        // Convert to FileItem format
        const items: FileItem[] = response.data.map((filePath) => {
          const pathParts = filePath.split(/[/\\]/)
          const name = pathParts[pathParts.length - 1] || filePath
          // Determine if it's a directory by checking if there's a file extension
          const isDirectory = !name.includes('.') || name.endsWith('/')
          return {
            name,
            path: filePath,
            isDirectory,
          }
        })

        // Sort: folders first, then files, both alphabetically
        const sortedItems = items.sort((a, b) => {
          if (a.isDirectory && !b.isDirectory) return -1
          if (!a.isDirectory && b.isDirectory) return 1
          return a.name.localeCompare(b.name)
        })
        setFiles(sortedItems)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load files')
      setFiles([])
    } finally {
      setIsLoading(false)
    }
  }, [onlyFolders])
  
  // Filter files based on search query
  const filteredFiles = useMemo(() => {
    if (!searchQuery.trim()) return files
    
    const query = searchQuery.toLowerCase()
    return files.filter(file => 
      file.name.toLowerCase().includes(query)
    )
  }, [files, searchQuery])
  
  // Helper function to normalize paths to POSIX format for comparison
  const normalizeToPosix = useCallback((p: string): string => {
    if (!p) return ''
    
    // Convert Windows path (C:\Users\...) to POSIX format (/C/Users/...)
    let normalized = p
    
    // Handle Windows drive letter format: C:\ or C:/
    const driveMatch = normalized.match(/^([A-Za-z]):[\\/]/)
    if (driveMatch) {
      const drive = driveMatch[1]
      normalized = `/${drive}${normalized.substring(2)}`
    }
    
    // Replace all backslashes with forward slashes
    normalized = normalized.replace(/\\/g, '/')
    
    // Remove duplicate slashes
    normalized = normalized.replace(/\/+/g, '/')
    
    // Remove trailing slash (except for root)
    if (normalized.length > 1 && normalized.endsWith('/')) {
      normalized = normalized.slice(0, -1)
    }
    
    return normalized
  }, [])
  
  // Parse current path into breadcrumb segments (only show relative to initialPath)
  const breadcrumbs = useMemo(() => {
    try {
      const normalizedInitial = normalizeToPosix(initialPath)
      const normalizedCurrent = normalizeToPosix(currentPath)
      
      // If current path is the same as initial, show root only
      if (normalizedCurrent === normalizedInitial) {
        const folderName = initialPath.split(/[/\\]/).filter(Boolean).pop() || 'Root'
        return [{ label: folderName, path: initialPath, isRoot: true }]
      }
      
      // Check if current path is under initial path
      if (!normalizedCurrent.startsWith(normalizedInitial + '/') && normalizedCurrent !== normalizedInitial) {
        // Current path is outside initial path - prevent navigation
        console.warn('Current path is outside initial path, showing only current')
        const folderName = currentPath.split(/[/\\]/).filter(Boolean).pop() || 'Root'
        return [{ label: folderName, path: currentPath, isRoot: true }]
      }
      
      // Build breadcrumbs for subdirectories
      const crumbs: Array<{ label: string; path: string; isRoot?: boolean }> = []
      
      // Add root breadcrumb (initialPath)
      const rootName = initialPath.split(/[/\\]/).filter(Boolean).pop() || 'Root'
      crumbs.push({ label: rootName, path: initialPath, isRoot: true })
      
      // Get relative path from initial to current
      let relativePath = normalizedCurrent.substring(normalizedInitial.length)
      if (relativePath.startsWith('/')) {
        relativePath = relativePath.substring(1)
      }
      
      if (!relativePath) {
        // Already at root
        return crumbs
      }
      
      // Determine separator from original path
      const isWindowsPath = /^[A-Za-z]:/.test(currentPath) || currentPath.startsWith('\\\\')
      const separator = isWindowsPath ? '\\' : '/'
      
      // Add subdirectory breadcrumbs
      const parts = relativePath.split('/').filter(Boolean)
      let accumulated = initialPath.endsWith(separator) || initialPath.endsWith('/') 
        ? initialPath.slice(0, -1) 
        : initialPath
      
      for (let i = 0; i < parts.length; i++) {
        accumulated += separator + parts[i]
        
        crumbs.push({
          label: parts[i],
          path: accumulated
        })
      }
      
      return crumbs
    } catch (error) {
      // Fallback: just show current path name
      console.error('Error parsing path for breadcrumbs:', error)
      const folderName = currentPath.split(/[/\\]/).filter(Boolean).pop() || 'Current'
      return [{ label: folderName, path: currentPath, isRoot: true }]
    }
  }, [currentPath, initialPath, normalizeToPosix])

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
      // Verify the target path is under initialPath
      const normalizedTarget = normalizeToPosix(file.path)
      const normalizedInitial = normalizeToPosix(initialPath)
      
      // Only allow if target is exactly initialPath or under it
      if (normalizedTarget === normalizedInitial || normalizedTarget.startsWith(normalizedInitial + '/')) {
        const newHistory = [...pathHistory, currentPath]
        setPathHistory(newHistory)
        onPathChange(file.path)
        onFileSelect(null)
      } else {
        console.warn('Cannot navigate outside initialPath:', { targetPath: file.path, initialPath, normalizedTarget, normalizedInitial })
      }
    }
    // Call optional double click handler
    onFileDoubleClick?.(file)
  }

  const handleGoBack = () => {
    if (pathHistory.length > 1) {
      const newHistory = [...pathHistory]
      newHistory.pop() // Remove current path
      const previousPath = newHistory[newHistory.length - 1]
      
      // Prevent going beyond initialPath
      const normalizedPrevious = normalizeToPosix(previousPath)
      const normalizedInitial = normalizeToPosix(initialPath)
      
      // Allow if it's exactly initialPath or starts with initialPath + '/'
      if (normalizedPrevious === normalizedInitial || normalizedPrevious.startsWith(normalizedInitial + '/')) {
        setPathHistory(newHistory)
        onPathChange(previousPath)
        onFileSelect(null)
      } else {
        console.warn('Cannot navigate beyond initialPath:', { previousPath, initialPath, normalizedPrevious, normalizedInitial })
      }
    }
  }
  
  const handleBreadcrumbClick = (path: string) => {
    // Prevent navigation outside of initialPath
    const normalizedPath = normalizeToPosix(path)
    const normalizedInitial = normalizeToPosix(initialPath)
    
    // Only allow navigation if path is initialPath or under it (exact match or starts with initialPath + '/')
    if (normalizedPath !== normalizedInitial && !normalizedPath.startsWith(normalizedInitial + '/')) {
      console.warn('Cannot navigate outside initialPath:', { path, initialPath, normalizedPath, normalizedInitial })
      return
    }
    
    // Find this path in history or add it
    const existingIndex = pathHistory.indexOf(path)
    if (existingIndex >= 0) {
      // Truncate history to this point
      setPathHistory(pathHistory.slice(0, existingIndex + 1))
    } else {
      // Add to history
      setPathHistory([...pathHistory, path])
    }
    onPathChange(path)
    onFileSelect(null)
  }
  
  // Keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (filteredFiles.length === 0) return
    
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setFocusedIndex(prev => 
          prev < filteredFiles.length - 1 ? prev + 1 : prev
        )
        break
      case 'ArrowUp':
        e.preventDefault()
        setFocusedIndex(prev => prev > 0 ? prev - 1 : 0)
        break
      case 'Enter':
        e.preventDefault()
        if (focusedIndex >= 0 && focusedIndex < filteredFiles.length) {
          const file = filteredFiles[focusedIndex]
          handleItemDoubleClick(file)
        }
        break
      case 'Escape':
        e.preventDefault()
        onFileSelect(null)
        setFocusedIndex(-1)
        break
    }
  }, [filteredFiles, focusedIndex])
  
  // Update focused item when clicking
  useEffect(() => {
    if (selectedFile) {
      const index = filteredFiles.findIndex(f => f.path === selectedFile.path)
      setFocusedIndex(index)
    }
  }, [selectedFile, filteredFiles])

  return (
    <div 
      className={cn("flex flex-col gap-3 overflow-hidden", className)}
      onKeyDown={handleKeyDown}
      tabIndex={0}
    >
      {/* Breadcrumb Navigation */}
      {showPathBar && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-1 min-w-0 flex-wrap">
            {(() => {
              // Check if we can go back (not at initialPath)
              const canGoBack = pathHistory.length > 1 && normalizeToPosix(currentPath) !== normalizeToPosix(initialPath)
              return canGoBack && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleGoBack}
                  disabled={isLoading}
                  className="shrink-0 h-8 px-2"
                >
                  <ChevronRight className="h-4 w-4 rotate-180" />
                </Button>
              )
            })()}
            <div className="flex items-center gap-1 min-w-0 flex-1 flex-wrap">
              {breadcrumbs.map((crumb, index) => (
                <div key={crumb.path} className="flex items-center gap-1 min-w-0">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleBreadcrumbClick(crumb.path)}
                    disabled={isLoading || index === breadcrumbs.length - 1}
                    className={cn(
                      "h-8 px-2 text-sm font-medium transition-colors",
                      index === breadcrumbs.length - 1 
                        ? "text-foreground cursor-default" 
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {index === 0 && <Home className="h-4 w-4 mr-1" />}
                    <span className="truncate max-w-[200px]">{crumb.label}</span>
                  </Button>
                  {index < breadcrumbs.length - 1 && (
                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                  )}
                </div>
              ))}
            </div>
          </div>
          
          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search files and folders..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              disabled={isLoading}
              className="pl-9 pr-9 h-9"
            />
            {searchQuery && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSearchQuery("")}
                className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      )}
      
      {/* File List */}
      <div className="flex-1 w-full rounded-lg border bg-card overflow-hidden relative shadow-sm" style={{ minHeight: 0 }}>
        <style>{`
          .file-explorer-scroll-container [data-slot="scroll-area-viewport"] {
            display: block !important;
            width: 100% !important;
            max-width: 100% !important;
            min-width: 0 !important;
          }
          .file-item {
            transition: all 0.15s ease-in-out;
          }
          .file-item:hover {
            transform: translateX(4px);
          }
        `}</style>
        <ScrollArea className="h-full w-full file-explorer-scroll-container">
          <div className="p-2 w-full">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">Loading...</p>
              </div>
            ) : error ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <div className="rounded-full bg-destructive/10 p-3">
                  <X className="h-6 w-6 text-destructive" />
                </div>
                <div className="text-center max-w-md">
                  <p className="text-sm font-medium text-destructive mb-1">Error loading files</p>
                  <p className="text-xs text-muted-foreground">{error}</p>
                </div>
              </div>
            ) : filteredFiles.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <div className="rounded-full bg-muted p-3">
                  <File className="h-6 w-6 text-muted-foreground" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium text-foreground mb-1">
                    {searchQuery ? 'No matches found' : 'Empty directory'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {searchQuery ? `No files match "${searchQuery}"` : 'This folder contains no files'}
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-0.5">
                {filteredFiles.map((file, index) => {
                  const badge = getFileTypeBadge(file.name, file.isDirectory ?? false)
                  const isFocused = index === focusedIndex
                  const isSelected = selectedFile?.path === file.path
                  
                  return (
                    <div
                      key={file.path}
                      onClick={() => handleItemClick(file)}
                      onDoubleClick={() => handleItemDoubleClick(file)}
                      className={cn(
                        "file-item flex items-center gap-3 p-3 rounded-lg cursor-pointer group",
                        "hover:bg-accent/50 active:bg-accent",
                        isSelected && "bg-primary/10 hover:bg-primary/15",
                        isFocused && "ring-2 ring-primary ring-inset"
                      )}
                    >
                      <div className="shrink-0">
                        {getFileIcon(file.name, file.isDirectory ?? false)}
                      </div>
                      
                      <div className="flex-1 min-w-0 flex items-center gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className={cn(
                              "font-medium truncate block",
                              file.isDirectory ? "text-foreground" : "text-foreground/90"
                            )}>
                              {file.name}
                            </span>
                            {badge && (
                              <span className={cn(
                                "text-[10px] font-semibold px-1.5 py-0.5 rounded",
                                badge.color
                              )}>
                                {badge.label}
                              </span>
                            )}
                          </div>
                          <span className="text-xs text-muted-foreground truncate block mt-0.5">
                            {file.path}
                          </span>
                        </div>
                        
                        {file.isDirectory && (
                          <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </ScrollArea>
      </div>
      
      {/* Status Bar */}
      {!isLoading && !error && filteredFiles.length > 0 && (
        <div className="flex items-center justify-between px-3 py-2 bg-muted/30 rounded-md text-xs text-muted-foreground">
          <span>
            {filteredFiles.filter(f => f.isDirectory).length} folders, {filteredFiles.filter(f => !f.isDirectory).length} files
          </span>
          {searchQuery && (
            <span>
              Showing {filteredFiles.length} of {files.length} items
            </span>
          )}
        </div>
      )}
    </div>
  )
}

