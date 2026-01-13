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
  RefreshCw,
  ArrowUp,
  ArrowDown
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { listFiles } from "@/api/listFiles"
import { listDrivesApi } from "@/api/listDrives"
import { openFile } from "@/api/openFile"
import type { FileItem } from "@/components/dialogs/types"
import { useTranslation } from "@/lib/i18n"

// Special path constant for drives view
const DRIVES_VIEW_PATH = '__DRIVES__'

// Helper function to get file extension
function getFileExtension(filename: string): string {
  const parts = filename.split('.')
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : ''
}

// Helper function to check if a file is an image
function isImageFile(filename: string): boolean {
  const ext = getFileExtension(filename)
  const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg', 'webp', 'ico', 'tiff']
  return imageExtensions.includes(ext)
}

// Helper function to get file icon based on extension
function getFileIcon(filename: string, isDirectory: boolean, isDrive: boolean = false) {
  if (isDrive) {
    return <HardDrive className="h-4 w-4 text-emerald-500" />
  }
  if (isDirectory) {
    return <FolderOpen className="h-4 w-4 text-blue-500" />
  }
  
  const ext = getFileExtension(filename)
  
  // Video files
  if (['mp4', 'mkv', 'avi', 'mov', 'wmv', 'flv', 'webm', 'm4v', 'mpg', 'mpeg'].includes(ext)) {
    return <FileVideo className="h-4 w-4 text-purple-500" />
  }
  
  // Audio files
  if (['mp3', 'wav', 'flac', 'aac', 'ogg', 'wma', 'm4a', 'opus'].includes(ext)) {
    return <FileAudio className="h-4 w-4 text-green-500" />
  }
  
  // Image files
  if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg', 'webp', 'ico', 'tiff'].includes(ext)) {
    return <FileImage className="h-4 w-4 text-pink-500" />
  }
  
  // Code files
  if (['js', 'ts', 'jsx', 'tsx', 'py', 'java', 'cpp', 'c', 'h', 'cs', 'go', 'rs', 'php', 'rb', 'swift'].includes(ext)) {
    return <FileCode className="h-4 w-4 text-yellow-500" />
  }
  
  // Archive files
  if (['zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz'].includes(ext)) {
    return <FileArchive className="h-4 w-4 text-orange-500" />
  }
  
  // Text/Document files
  if (['txt', 'md', 'pdf', 'doc', 'docx', 'rtf', 'odt'].includes(ext)) {
    return <FileText className="h-4 w-4 text-blue-400" />
  }
  
  // Subtitle files
  if (['srt', 'ass', 'ssa', 'sub', 'vtt'].includes(ext)) {
    return <Layers className="h-4 w-4 text-cyan-500" />
  }
  
  // Default
  return <File className="h-4 w-4 text-gray-400" />
}

// Helper function to format file size
function formatFileSize(size: number): string {
  if (size < 1024) {
    return `${size} B`
  } else if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(0)} KB`
  } else if (size < 1024 * 1024 * 1024) {
    return `${(size / (1024 * 1024)).toFixed(1)} MB`
  } else {
    return `${(size / (1024 * 1024 * 1024)).toFixed(2)} GB`
  }
}

// Helper function to format relative date
function formatRelativeDate(mtime: number): string {
  const now = Date.now()
  const diff = now - mtime
  const seconds = Math.floor(diff / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (seconds < 60) {
    return "Just now"
  } else if (minutes < 60) {
    return `${minutes} minute${minutes !== 1 ? 's' : ''} ago`
  } else if (hours < 24) {
    return `${hours} hour${hours !== 1 ? 's' : ''} ago`
  } else if (days === 0) {
    const date = new Date(mtime)
    return `Today at ${date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}`
  } else if (days === 1) {
    const date = new Date(mtime)
    return `Yesterday at ${date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}`
  } else if (days < 7) {
    return `${days} days ago`
  } else {
    const date = new Date(mtime)
    return date.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })
  }
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
  showStatusBar?: boolean
  onlyFolders?: boolean
  restrictToInitialPath?: boolean
  visibleColumns?: ('name' | 'size' | 'date')[]
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
  showStatusBar = true,
  onlyFolders = false,
  restrictToInitialPath = true,
  visibleColumns = ['name', 'size', 'date'],
}: FileExplorerProps) {
  const { t } = useTranslation('components')
  const [files, setFiles] = useState<FileItem[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pathHistory, setPathHistory] = useState<string[]>([initialPath])
  const [searchQuery, setSearchQuery] = useState("")
  const [focusedIndex, setFocusedIndex] = useState<number>(-1)
  const [showDrives, setShowDrives] = useState(false)
  const [sortColumn, setSortColumn] = useState<'name' | 'size' | 'date'>('name')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')

  // Generate grid column template based on visible columns
  const gridColsTemplate = useMemo(() => {
    const templates: Record<'name' | 'size' | 'date', string> = {
      name: '1fr',
      size: '100px',
      date: '150px',
    }
    return visibleColumns.map(col => templates[col]).join(' ')
  }, [visibleColumns])

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
          // Handle both old format (strings) and new format (objects) for backward compatibility
          const items: FileItem[] = response.data.items
            .map((item) => {
              // Check if item is a string (old format) or object (new format)
              let path: string
              let isDirectory: boolean | undefined
              let size: number | undefined
              let mtime: number | undefined

              if (typeof item === 'string') {
                // Old format: item is a string path
                path = item
                const pathParts = path.split(/[/\\]/)
                const name = pathParts[pathParts.length - 1] || path
                // Determine if it's a directory by checking if there's a file extension
                isDirectory = !name.includes('.') || name.endsWith('/')
                size = undefined
                mtime = undefined
              } else {
                // New format: item is an object with metadata
                path = item.path || ''
                if (!path) {
                  console.warn('[FileExplorer] item has no path:', item)
                  return null
                }
                isDirectory = item.isDirectory
                size = item.size
                mtime = item.mtime
              }

              const pathParts = path.split(/[/\\]/)
              const name = pathParts[pathParts.length - 1] || path

              const fileItem: FileItem = {
                name,
                path,
                isDirectory,
                size,
                mtime,
              }
              return fileItem
            })
            .filter((item): item is FileItem => item !== null)

          setFiles(items)
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
  
  // Sort files based on sortColumn and sortDirection
  const sortedFiles = useMemo(() => {
    const filesToSort = [...filteredFiles]
    
    return filesToSort.sort((a, b) => {
      // Always put folders first
      if (a.isDirectory && !b.isDirectory) return -1
      if (!a.isDirectory && b.isDirectory) return 1
      
      // Both are folders or both are files, sort by selected column
      let comparison = 0
      
      if (sortColumn === 'name') {
        comparison = a.name.localeCompare(b.name)
      } else if (sortColumn === 'size') {
        const sizeA = a.size ?? 0
        const sizeB = b.size ?? 0
        comparison = sizeA - sizeB
      } else if (sortColumn === 'date') {
        const dateA = a.mtime ?? 0
        const dateB = b.mtime ?? 0
        comparison = dateA - dateB
      }
      
      return sortDirection === 'asc' ? comparison : -comparison
    })
  }, [filteredFiles, sortColumn, sortDirection])
  
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

  // Ensure sort column is valid when visible columns change
  useEffect(() => {
    if (!visibleColumns.includes(sortColumn)) {
      // Default to first visible column, or 'name' if available
      const defaultColumn = visibleColumns.includes('name') ? 'name' : visibleColumns[0] || 'name'
      setSortColumn(defaultColumn as 'name' | 'size' | 'date')
    }
  }, [visibleColumns, sortColumn])

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

  const handleItemDoubleClick = async (file: FileItem) => {
    // Double-click: open image files or navigate into folder
    if (!file.isDirectory && isImageFile(file.name)) {
      // Open image file with system default application
      try {
        await openFile(file.path)
      } catch (error) {
        console.error('[FileExplorer] Failed to open image file:', error)
      }
      // Call optional double click handler
      onFileDoubleClick?.(file)
      return
    }

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
  
  // Handle column header click for sorting
  const handleColumnHeaderClick = (column: 'name' | 'size' | 'date') => {
    if (sortColumn === column) {
      // Toggle direction if clicking same column
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      // Set new column with ascending direction
      setSortColumn(column)
      setSortDirection('asc')
    }
  }
  
  // Keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (sortedFiles.length === 0) return
    
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setFocusedIndex(prev => 
          prev < sortedFiles.length - 1 ? prev + 1 : prev
        )
        break
      case 'ArrowUp':
        e.preventDefault()
        setFocusedIndex(prev => prev > 0 ? prev - 1 : 0)
        break
      case 'Enter':
        e.preventDefault()
        if (focusedIndex >= 0 && focusedIndex < sortedFiles.length) {
          const file = sortedFiles[focusedIndex]
          handleItemDoubleClick(file)
        }
        break
      case 'Escape':
        e.preventDefault()
        onFileSelect(null)
        setFocusedIndex(-1)
        break
    }
  }, [sortedFiles, focusedIndex])
  
  // Update focused item when clicking
  useEffect(() => {
    if (selectedFile) {
      const index = sortedFiles.findIndex(f => f.path === selectedFile.path)
      setFocusedIndex(index)
    }
  }, [selectedFile, sortedFiles])

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
            transition: background-color 0.15s ease-in-out;
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
            ) : sortedFiles.length === 0 ? (
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
              <div className="flex flex-col gap-0">
                {/* Column Headers */}
                <div 
                  className="grid gap-2 px-2 py-1.5 border-b bg-muted/50 text-xs font-semibold text-muted-foreground sticky top-0 z-10 min-w-0"
                  style={{ gridTemplateColumns: gridColsTemplate }}
                >
                  {visibleColumns.includes('name') && (
                    <button
                      onClick={() => handleColumnHeaderClick('name')}
                      className="flex items-center gap-1.5 text-left hover:text-foreground transition-colors rounded px-1 py-0.5 -mx-1 -my-0.5 min-w-0 overflow-hidden"
                    >
                      <span className="truncate">Name</span>
                      {sortColumn === 'name' && (
                        sortDirection === 'asc' ? <ArrowUp className="h-3 w-3 shrink-0" /> : <ArrowDown className="h-3 w-3 shrink-0" />
                      )}
                    </button>
                  )}
                  {visibleColumns.includes('size') && (
                    <button
                      onClick={() => handleColumnHeaderClick('size')}
                      className="flex items-center justify-end gap-1.5 text-right hover:text-foreground transition-colors rounded px-1 py-0.5 -mx-1 -my-0.5"
                    >
                      <span>Size</span>
                      {sortColumn === 'size' && (
                        sortDirection === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                      )}
                    </button>
                  )}
                  {visibleColumns.includes('date') && (
                    <button
                      onClick={() => handleColumnHeaderClick('date')}
                      className="flex items-center justify-end gap-1.5 text-right hover:text-foreground transition-colors rounded px-1 py-0.5 -mx-1 -my-0.5"
                    >
                      <span>Date Modified</span>
                      {sortColumn === 'date' && (
                        sortDirection === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                      )}
                    </button>
                  )}
                </div>
                {/* File Rows */}
                {sortedFiles.map((file, index) => {
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
                        "file-item grid gap-2 px-2 py-1.5 cursor-pointer group items-center select-none min-w-0",
                        "hover:bg-accent/50 active:bg-accent",
                        isSelected && "bg-primary/10 hover:bg-primary/15",
                        isFocused && "ring-2 ring-primary ring-inset"
                      )}
                      style={{ gridTemplateColumns: gridColsTemplate }}
                    >
                      {/* Name Column */}
                      {visibleColumns.includes('name') && (
                        <div className="flex items-center gap-2 min-w-0 overflow-hidden">
                          <div className="shrink-0">
                            {getFileIcon(file.name, file.isDirectory ?? false, isDrive)}
                          </div>
                          <span className={cn(
                            "text-sm font-medium truncate min-w-0 flex-1",
                            file.isDirectory ? "text-foreground" : "text-foreground/90"
                          )}>
                            {file.name}
                          </span>
                          {file.isDirectory && (
                            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                          )}
                        </div>
                      )}
                      
                      {/* Size Column */}
                      {visibleColumns.includes('size') && (
                        <div className="text-sm text-muted-foreground text-right truncate">
                          {file.isDirectory ? '--' : (file.size !== undefined ? formatFileSize(file.size) : '--')}
                        </div>
                      )}
                      
                      {/* Date Column */}
                      {visibleColumns.includes('date') && (
                        <div className="text-sm text-muted-foreground text-right truncate">
                          {file.mtime !== undefined ? formatRelativeDate(file.mtime) : '--'}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </ScrollArea>
      </div>
      
      {/* Status Bar */}
      {showStatusBar && !isLoading && !error && sortedFiles.length > 0 && (
        <div className="flex items-center justify-between px-3 py-2 bg-muted/30 rounded-md text-xs text-muted-foreground">
          <span>
            {showDrives
              ? String((t as any)('fileExplorer.drivesStatus', { count: sortedFiles.length }))
              : String((t as any)('fileExplorer.statusBar', {
                  folders: sortedFiles.filter(f => f.isDirectory).length,
                  files: sortedFiles.filter(f => !f.isDirectory).length
                }))}
          </span>
          {searchQuery && (
            <span>
              {String((t as any)('fileExplorer.searchStatus', {
                showing: sortedFiles.length,
                total: files.length
              }))}
            </span>
          )}
        </div>
      )}
    </div>
  )
}

