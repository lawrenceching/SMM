import { useState, useCallback, useEffect, useMemo } from "react"
import {
  Loader2,
  File,
  FolderOpen,
  Home,
  ChevronRight,
  ChevronUp,
  Search,
  X,
  FileText,
  FileVideo,
  FileAudio,
  FileImage,
  FileCode,
  FileArchive,
  Layers,
  HardDrive,
  RefreshCw
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { listFiles } from "@/api/listFiles"
import { listDrivesApi } from "@/api/listDrives"
import type { FileItem } from "@/components/dialogs/types"
import { useTranslation } from "@/lib/i18n"

// Special path constant for drives view
const DRIVES_VIEW_PATH = '__DRIVES__'

// Helper function to get file extension
function getFileExtension(filename: string): string {
  const parts = filename.split('.')
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : ''
}

// Helper function to get file icon based on extension
function getFileIcon(filename: string, isDirectory: boolean, isDrive: boolean = false) {
  if (isDrive) {
    return <HardDrive className="h-5 w-5 text-emerald-500" />
  }
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
  restrictToInitialPath?: boolean
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
  restrictToInitialPath = true,
}: FileExplorerProps) {
  const { t } = useTranslation('components')
  const [files, setFiles] = useState<FileItem[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pathHistory, setPathHistory] = useState<string[]>([initialPath])
  const [searchQuery, setSearchQuery] = useState("")
  const [focusedIndex, setFocusedIndex] = useState<number>(-1)
  const [showDrives, setShowDrives] = useState(false)

  const loadFiles = useCallback(async (path: string) => {
    // Skip loading if we're in drives view (drives are loaded separately)
    if (path === DRIVES_VIEW_PATH) {
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    setError(null)
    setSearchQuery("") // Clear search when loading new directory
    setFocusedIndex(-1) // Reset focus
    try {
      const response = await listFiles({
        path: path,
        onlyFolders,
        includeHiddenFiles: false,
      })
      
      if (response.error) {
        setError(response.error || t('fileExplorer.loadFailed'))
        setFiles([])
      } else {

        if(!response.data) {
          console.error('[FileExplorer] unexpected response body: no data', response)
          setFiles([])
        } else {
          // Update path to the resolved path from API (e.g., "~" -> "C:\Users\<username>")
          const resolvedPath = response.data.path
          if (resolvedPath && resolvedPath !== path) {
            // Update the path to the resolved path
            onPathChange(resolvedPath)
          }

          // Convert to FileItem format
          const items: FileItem[] = response.data.items.map((filePath) => {
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

        
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('fileExplorer.loadFailed'))
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
  
  // Parse current path into breadcrumb segments
  const breadcrumbs = useMemo(() => {
    try {
      const normalizedInitial = normalizeToPosix(initialPath)
      const normalizedCurrent = normalizeToPosix(currentPath)

      // Show "Drives" breadcrumb when in drives view
      if (currentPath === DRIVES_VIEW_PATH) {
        return [{ label: String((t as any)('fileExplorer.drives')), path: DRIVES_VIEW_PATH, isRoot: true }]
      }

      // If restriction is disabled, show full path breadcrumbs
      if (!restrictToInitialPath) {
        const crumbs: Array<{ label: string; path: string; isRoot?: boolean }> = []
        const isWindowsPath = /^[A-Za-z]:/.test(currentPath) || currentPath.startsWith('\\\\')
        const separator = isWindowsPath ? '\\' : '/'
        
        // Handle Windows drive letter path (C:\Users\...)
        if (isWindowsPath) {
          const driveMatch = currentPath.match(/^([A-Za-z]):/)
          if (driveMatch) {
            const drive = driveMatch[1]
            // Remove drive letter and split the rest
            const pathWithoutDrive = currentPath.substring(2) // Remove "C:"
            const pathParts = pathWithoutDrive.split(/[/\\]/).filter(Boolean)
            
            // Add drive root
            crumbs.push({
              label: `${drive}:`,
              path: `${drive}:\\`,
              isRoot: true
            })
            
            // Build accumulated path for remaining parts
            let accumulated = `${drive}:\\`
            for (let i = 0; i < pathParts.length; i++) {
              accumulated += (i > 0 ? separator : '') + pathParts[i]
              crumbs.push({
                label: pathParts[i],
                path: accumulated,
                isRoot: false
              })
            }
          } else if (currentPath.startsWith('\\\\')) {
            // UNC path (\\server\share\...)
            const pathWithoutPrefix = currentPath.substring(2) // Remove "\\"
            const pathParts = pathWithoutPrefix.split(/[/\\]/).filter(Boolean)
            
            let accumulated = '\\\\'
            for (let i = 0; i < pathParts.length; i++) {
              accumulated += (i > 0 ? separator : '') + pathParts[i]
              crumbs.push({
                label: pathParts[i],
                path: accumulated,
                isRoot: i < 2
              })
            }
          }
        } else {
          // POSIX path
          const pathParts = currentPath.split('/').filter(Boolean)
          let accumulated = '/'
          for (let i = 0; i < pathParts.length; i++) {
            accumulated += (i > 0 ? '/' : '') + pathParts[i]
            crumbs.push({
              label: pathParts[i],
              path: accumulated,
              isRoot: i === 0
            })
          }
        }
        
        return crumbs.length > 0 ? crumbs : [{ label: currentPath, path: currentPath, isRoot: true }]
      }
      
      // Restricted mode: only show relative to initialPath
      // If current path is the same as initial, show root only
      if (normalizedCurrent === normalizedInitial) {
        const folderName = initialPath.split(/[/\\]/).filter(Boolean).pop() || t('fileExplorer.root')
        return [{ label: folderName, path: initialPath, isRoot: true }]
      }
      
      // Check if current path is under initial path
      if (!normalizedCurrent.startsWith(normalizedInitial + '/') && normalizedCurrent !== normalizedInitial) {
        // Current path is outside initial path - prevent navigation
        console.warn('Current path is outside initial path, showing only current')
        const folderName = currentPath.split(/[/\\]/).filter(Boolean).pop() || t('fileExplorer.root')
        return [{ label: folderName, path: currentPath, isRoot: true }]
      }
      
      // Build breadcrumbs for subdirectories
      const crumbs: Array<{ label: string; path: string; isRoot?: boolean }> = []
      
      // Add root breadcrumb (initialPath)
      const rootName = initialPath.split(/[/\\]/).filter(Boolean).pop() || t('fileExplorer.root')
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
      const folderName = currentPath.split(/[/\\]/).filter(Boolean).pop() || t('fileExplorer.current')
      return [{ label: folderName, path: currentPath, isRoot: true }]
    }
  }, [currentPath, initialPath, normalizeToPosix, restrictToInitialPath, t])

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
      // Check if we're in drives view - if so, navigate to the selected drive
      if (showDrives) {
        setShowDrives(false)
        // Remove DRIVES_VIEW_PATH from history and navigate to the drive
        const newHistory = pathHistory.filter(p => p !== DRIVES_VIEW_PATH)
        newHistory.push(file.path)
        setPathHistory(newHistory)
        onPathChange(file.path)
        onFileSelect(null)
        return
      }

      if (restrictToInitialPath) {
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
      } else {
        // Unrestricted mode: allow navigation to any path
        const newHistory = [...pathHistory, currentPath]
        setPathHistory(newHistory)
        onPathChange(file.path)
        onFileSelect(null)
      }
    }
    // Call optional double click handler
    onFileDoubleClick?.(file)
  }

  const handleGoToParent = async () => {
    // Determine separator from current path
    const isWindowsPath = /^[A-Za-z]:/.test(currentPath) || currentPath.startsWith('\\\\')
    const separator = isWindowsPath ? '\\' : '/'

    // Calculate parent path
    let parentPath: string

    if (isWindowsPath) {
      // Handle Windows paths
      const driveMatch = currentPath.match(/^([A-Za-z]):/)
      if (driveMatch) {
        const drive = driveMatch[1]
        const pathWithoutDrive = currentPath.substring(2)

        if (!pathWithoutDrive || pathWithoutDrive === separator) {
          // Already at drive root - show drives list
          setIsLoading(true)
          setError(null)
          try {
            const response = await listDrivesApi()
            if (response.error) {
              setError(response.error)
              setFiles([])
            } else {
              // Convert drives to FileItem format
              const driveItems: FileItem[] = response.data.map((drivePath) => ({
                name: drivePath,
                path: drivePath,
                isDirectory: true,
              }))
              setFiles(driveItems)
              setShowDrives(true)
              // Add current path to history for going back
              const newHistory = [...pathHistory, currentPath]
              setPathHistory(newHistory)
              onPathChange(DRIVES_VIEW_PATH)
              onFileSelect(null)
            }
          } catch (err) {
            setError(err instanceof Error ? err.message : t('fileExplorer.loadFailed'))
            setFiles([])
          } finally {
            setIsLoading(false)
          }
          return
        }

        // Find the last separator
        const lastSeparatorIndex = pathWithoutDrive.lastIndexOf(separator)

        if (lastSeparatorIndex <= 0) {
          // No more separators (or only at position 0), go to drive root with trailing backslash
          parentPath = `${drive}:\\`
        } else {
          parentPath = `${drive}:${pathWithoutDrive.substring(0, lastSeparatorIndex)}`
        }
      } else if (currentPath.startsWith('\\\\')) {
        // UNC path
        const pathParts = currentPath.split(/[\\]/).filter(Boolean)
        if (pathParts.length <= 2) {
          // At server/share level, stay there
          return
        }
        parentPath = '\\\\' + pathParts.slice(0, -1).join('\\')
      } else {
        parentPath = currentPath
      }
    } else {
      // POSIX path
      if (currentPath === '/' || currentPath === '') {
        // Already at root
        return
      }

      const pathParts = currentPath.split('/').filter(Boolean)
      if (pathParts.length <= 1) {
        // Go to root
        parentPath = '/'
      } else {
        pathParts.pop()
        parentPath = '/' + pathParts.join('/')
      }
    }

    // Check restrictions
    if (restrictToInitialPath) {
      const normalizedParent = normalizeToPosix(parentPath)
      const normalizedInitial = normalizeToPosix(initialPath)

      // Allow navigating to "/" when initial path is "~" (home directory)
      if (normalizedInitial === '~' && normalizedParent === '/') {
        // Allowed - navigating from home to root
      } else if (normalizedParent !== normalizedInitial && !normalizedParent.startsWith(normalizedInitial + '/')) {
        console.warn('Cannot navigate outside initialPath:', { parentPath, initialPath, normalizedParent, normalizedInitial })
        return
      }
    }

    // Navigate to parent
    const newHistory = [...pathHistory, currentPath]
    setPathHistory(newHistory)
    onPathChange(parentPath)
    onFileSelect(null)
  }
  
  const handleBreadcrumbClick = (path: string) => {
    // Handle clicking on "Drives" breadcrumb - show drives view
    if (path === DRIVES_VIEW_PATH) {
      handleGoToParent()
      return
    }

    if (restrictToInitialPath) {
      // Prevent navigation outside of initialPath
      const normalizedPath = normalizeToPosix(path)
      const normalizedInitial = normalizeToPosix(initialPath)

      // Only allow navigation if path is initialPath or under it (exact match or starts with initialPath + '/')
      if (normalizedPath !== normalizedInitial && !normalizedPath.startsWith(normalizedInitial + '/')) {
        console.warn('Cannot navigate outside initialPath:', { path, initialPath, normalizedPath, normalizedInitial })
        return
      }
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
    // Clear drives view flag when navigating to a regular path
    if (showDrives) {
      setShowDrives(false)
    }
    onPathChange(path)
    onFileSelect(null)
  }

  const handleRefresh = () => {
    // Refresh files for the current path
    if (currentPath === DRIVES_VIEW_PATH) {
      // If in drives view, reload drives
      setIsLoading(true)
      setError(null)
      listDrivesApi()
        .then((response) => {
          if (response.error) {
            setError(response.error)
            setFiles([])
          } else {
            const driveItems: FileItem[] = response.data.map((drivePath) => ({
              name: drivePath,
              path: drivePath,
              isDirectory: true,
            }))
            setFiles(driveItems)
          }
        })
        .catch((err) => {
          setError(err instanceof Error ? err.message : t('fileExplorer.loadFailed'))
          setFiles([])
        })
        .finally(() => {
          setIsLoading(false)
        })
    } else {
      // Refresh regular files
      loadFiles(currentPath)
    }
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
      className={cn("flex flex-col gap-3 overflow-hidden h-full", className)}
      onKeyDown={handleKeyDown}
      tabIndex={0}
    >
      {/* Breadcrumb Navigation */}
      {showPathBar && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-1 min-w-0 flex-wrap">
            {(() => {
              // Check if we can go to parent folder
              const canGoToParent = (() => {
                const isWindowsPath = /^[A-Za-z]:/.test(currentPath) || currentPath.startsWith('\\\\')

                // Check if at Windows drive root (e.g., C:\)
                if (isWindowsPath) {
                  const driveMatch = currentPath.match(/^([A-Za-z]):/)
                  if (driveMatch) {
                    const pathWithoutDrive = currentPath.substring(2)
                    // At drive root (C:\), allow going up to show drives
                    if (!pathWithoutDrive || pathWithoutDrive === '\\' || pathWithoutDrive === '/') {
                      return true
                    }
                    // At subdirectory, allow going up
                    return true
                  }
                  // UNC path
                  if (currentPath.startsWith('\\\\')) {
                    const pathParts = currentPath.split(/[\\]/).filter(Boolean)
                    return pathParts.length > 2
                  }
                  return false
                }

                // POSIX path - can't go above root "/"
                if (currentPath === '/' || currentPath === '') {
                  return false
                }

                // For home directory "~" or paths starting with "~"
                if (currentPath === '~' || currentPath.startsWith('~/')) {
                  return true
                }

                // For other paths
                const pathParts = currentPath.split('/').filter(Boolean)
                return pathParts.length > 1 || (pathParts.length === 1 && currentPath.startsWith('/'))
              })()

              return canGoToParent && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleGoToParent}
                  disabled={isLoading}
                  className="shrink-0 h-8 px-2"
                  title={String((t as any)('fileExplorer.goToParent'))}
                >
                  <ChevronUp className="h-4 w-4" />
                </Button>
              )
            })()}
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRefresh}
              disabled={isLoading}
              className="shrink-0 h-8 px-2"
              title="Refresh"
            >
              <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
            </Button>
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
                    {index === 0 && (crumb.path === DRIVES_VIEW_PATH
                      ? <HardDrive className="h-4 w-4 mr-1" />
                      : <Home className="h-4 w-4 mr-1" />)}
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
              placeholder={t('fileExplorer.searchPlaceholder')}
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
                <p className="text-sm text-muted-foreground">{t('fileExplorer.loading')}</p>
              </div>
            ) : error ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <div className="rounded-full bg-destructive/10 p-3">
                  <X className="h-6 w-6 text-destructive" />
                </div>
                <div className="text-center max-w-md">
                  <p className="text-sm font-medium text-destructive mb-1">{t('fileExplorer.errorTitle')}</p>
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
                    {searchQuery ? t('fileExplorer.noMatches') : t('fileExplorer.emptyDirectory')}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {searchQuery ? t('fileExplorer.noMatchesDescription', { query: searchQuery }) : t('fileExplorer.emptyDirectoryDescription')}
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-0.5">
                {filteredFiles.map((file, index) => {
                  const badge = getFileTypeBadge(file.name, file.isDirectory ?? false)
                  const isFocused = index === focusedIndex
                  const isSelected = selectedFile?.path === file.path
                  // Check if this item is a drive (Windows drive path like "C:\")
                  const isDrive = showDrives && /^[A-Za-z]:\\$/.test(file.path)

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
                        {getFileIcon(file.name, file.isDirectory ?? false, isDrive)}
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
            {showDrives
              ? String((t as any)('fileExplorer.drivesStatus', { count: filteredFiles.length }))
              : String((t as any)('fileExplorer.statusBar', {
                  folders: filteredFiles.filter(f => f.isDirectory).length,
                  files: filteredFiles.filter(f => !f.isDirectory).length
                }))}
          </span>
          {searchQuery && (
            <span>
              {String((t as any)('fileExplorer.searchStatus', {
                showing: filteredFiles.length,
                total: files.length
              }))}
            </span>
          )}
        </div>
      )}
    </div>
  )
}

