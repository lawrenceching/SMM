import { ThreeColumnLayout, LeftSidebarContent, RightSidebarContent, SidebarContent } from "@/components/three-column-layout"
import { SearchForm } from "./components/search-form"
import { Menu } from "./components/menu"
import { StatusBar } from "./components/StatusBar"
import { ConfigProvider } from "./components/config-provider"
import { ThemeProvider } from "./components/theme-provider"
import { DialogProvider, useDialogs } from "./components/dialog-provider"
import { Button } from "./components/ui/button"
import { Toaster } from "./components/ui/sonner"
import { toast } from "sonner"
import { AiChatbox } from "./components/ai-chatbox"
import { useCallback, useMemo, useState, useEffect, useRef } from "react"
import { basename } from "./lib/path"
import { cn } from "@/lib/utils"
import type { FolderType } from "@/components/dialog-provider"
import { readMediaMetadataApi } from "@/api/readMediaMatadata"
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { ArrowUpDown, Filter, FolderOpen, Upload } from "lucide-react"
import Welcome from "./components/welcome"
import TvShowPanel from "./components/TvShowPanel"
import { MediaMetadataProvider, useMediaMetadata } from "./components/media-metadata-provider"

interface MediaFolderListItemProps {
  mediaName: string,
  /**
   * Absolute path of the media folder, in Platform-specific format
   */
  path: string,
  mediaType: 'tvshow' | 'movie' | 'music'

  /**
   * could be base64 encoded image data (data:image/svg+xml;base64,... or data:image/svg+xml;base64,...), file path (file://), web URL (https://)
   */
  icon?: string
  /**
   * Whether this folder is currently selected
   */
  selected?: boolean
  /**
   * Click handler for the folder item
   */
  onClick?: () => void
}


function MediaFolderListItem({mediaName, path, mediaType, selected, icon, onClick}: MediaFolderListItemProps) {

  const fallbackThumbnail = useMemo(() => {
    switch (mediaType) {
      case 'tvshow': {
        // TV show icon - purple/blue gradient with play icon
        const svg = `<svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect width="64" height="64" fill="#F0F0F0"/>
          <path d="M16 8H24L28 12H48V48H16V8Z" fill="url(#tvGradient)"/>
          <path d="M20 16H44V20H20V16Z" fill="#9333EA"/>
          <circle cx="32" cy="32" r="8" fill="white" opacity="0.9"/>
          <path d="M28 30L32 32L28 34V30Z" fill="#9333EA"/>
          <defs>
            <linearGradient id="tvGradient" x1="16" y1="8" x2="48" y2="48" gradientUnits="userSpaceOnUse">
              <stop stop-color="#9333EA"/>
              <stop offset="1" stop-color="#3B82F6"/>
            </linearGradient>
          </defs>
        </svg>`
        return `data:image/svg+xml;base64,${btoa(svg)}`
      }
      case 'movie': {
        // Movie icon - red/orange gradient with film strip
        const svg = `<svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect width="64" height="64" fill="#F0F0F0"/>
          <path d="M16 8H24L28 12H48V48H16V8Z" fill="url(#movieGradient)"/>
          <rect x="20" y="16" width="24" height="32" fill="white" opacity="0.2"/>
          <rect x="20" y="20" width="4" height="24" fill="white" opacity="0.3"/>
          <rect x="40" y="20" width="4" height="24" fill="white" opacity="0.3"/>
          <circle cx="32" cy="32" r="6" fill="white" opacity="0.9"/>
          <path d="M29 30L32 32L29 34V30Z" fill="#DC2626"/>
          <defs>
            <linearGradient id="movieGradient" x1="16" y1="8" x2="48" y2="48" gradientUnits="userSpaceOnUse">
              <stop stop-color="#DC2626"/>
              <stop offset="1" stop-color="#F97316"/>
            </linearGradient>
          </defs>
        </svg>`
        return `data:image/svg+xml;base64,${btoa(svg)}`
      }
      case 'music': {
        // Music icon - purple/pink gradient with music note
        const svg = `<svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect width="64" height="64" fill="#F0F0F0"/>
          <path d="M16 8H24L28 12H48V48H16V8Z" fill="url(#musicGradient)"/>
          <path d="M20 16H44V20H20V16Z" fill="#A855F7"/>
          <path d="M28 24C28 22.8954 28.8954 22 30 22H34C35.1046 22 36 22.8954 36 24V36C36 37.1046 35.1046 38 34 38H30C28.8954 38 28 37.1046 28 36V24Z" fill="white" opacity="0.9"/>
          <path d="M36 28L40 26V34L36 32V28Z" fill="white" opacity="0.9"/>
          <circle cx="30" cy="24" r="1.5" fill="#A855F7"/>
          <circle cx="34" cy="24" r="1.5" fill="#A855F7"/>
          <defs>
            <linearGradient id="musicGradient" x1="16" y1="8" x2="48" y2="48" gradientUnits="userSpaceOnUse">
              <stop stop-color="#A855F7"/>
              <stop offset="1" stop-color="#EC4899"/>
            </linearGradient>
          </defs>
        </svg>`
        return `data:image/svg+xml;base64,${btoa(svg)}`
      }
      default: {
        // Default folder icon - orange/yellow gradient
        const svg = `<svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect width="64" height="64" fill="#F0F0F0"/>
          <path d="M16 8H24L28 12H48V48H16V8Z" fill="#FFC700"/>
          <path d="M20 16H44V20H20V16Z" fill="#FFC700"/>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" x="20" y="20">
            <path d="M10 4H4V20H10V4Z" fill="white"/>
            <path d="M12 6H18V18H12V6Z" fill="white"/>
          </svg>
        </svg>`
        return `data:image/svg+xml;base64,${btoa(svg)}`
      }
    }
  }, [mediaType])

  const folderName = useMemo(() => {
    return basename(path)
  }, [path])

  return (
    <div 
      className={cn(
        "flex flex-col gap-2 p-2 rounded-md hover:bg-primary/10 cursor-pointer",
        selected && "bg-primary/30"
      )}
      onClick={onClick}
    >

<ContextMenu>
  <ContextMenuTrigger>
  <div className="flex items-center gap-2">
        <img src={fallbackThumbnail} alt={mediaName} className="w-10 h-10 rounded-md" />
        <div>
          <h5 className="text-sm font-bold">{mediaName}</h5>
          <p className="text-sm text-muted-foreground">{folderName}</p>
        </div>
      </div>

  </ContextMenuTrigger>
  <ContextMenuContent>
    <ContextMenuItem><div className="flex items-center gap-4">
      <span >Delete</span>
      <span className="text-xs text-muted-foreground">will NOT delete from disk</span>
      </div></ContextMenuItem>
    <ContextMenuItem>Open in Explorer</ContextMenuItem>
  </ContextMenuContent>
</ContextMenu>

      
    </div>
  )
}


type SortOrder = "alphabetical" | "reverse-alphabetical"
type FilterType = "all" | "tvshow" | "movie" | "music"

interface MediaFolderToolbarProps {
  sortOrder: SortOrder
  onSortOrderChange: (order: SortOrder) => void
  filterType: FilterType
  onFilterTypeChange: (type: FilterType) => void
}

function MediaFolderToolbar({
  sortOrder,
  onSortOrderChange,
  filterType,
  onFilterTypeChange,
}: MediaFolderToolbarProps) {
  const sortLabels: Record<SortOrder, string> = {
    alphabetical: "按字母顺序",
    "reverse-alphabetical": "按字母倒序",
  }

  const filterLabels: Record<FilterType, string> = {
    all: "全部类型",
    tvshow: "电视剧",
    movie: "电影",
    music: "音乐",
  }

  return (
    <div className="flex items-center gap-2 px-4 py-2 border-b">
      <Tooltip>
        <TooltipTrigger asChild>
          <div>
            <Select onValueChange={onSortOrderChange}>
              <SelectTrigger 
                size="sm" 
                className={cn(
                  "h-8 w-8 p-0 justify-center!",
                  "[&>svg:last-child]:hidden" // Hide the default chevron icon
                )}
              >
                <ArrowUpDown className="h-4 w-4" />
                <SelectValue className="sr-only" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="alphabetical">按字母顺序</SelectItem>
                <SelectItem value="reverse-alphabetical">按字母倒序</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p>排序: {sortLabels[sortOrder]}</p>
        </TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <div>
            <Select onValueChange={onFilterTypeChange}>
              <SelectTrigger 
                size="sm" 
                className={cn(
                  "h-8 w-8 p-0 justify-center!",
                  "[&>svg:last-child]:hidden" // Hide the default chevron icon
                )}
              >
                <Filter className="h-4 w-4" />
                <SelectValue className="sr-only" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部类型</SelectItem>
                <SelectItem value="tvshow">电视剧</SelectItem>
                <SelectItem value="movie">电影</SelectItem>
                <SelectItem value="music">音乐</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p>筛选: {filterLabels[filterType]}</p>
        </TooltipContent>
      </Tooltip>
    </div>
  )
}

function AppLayout() {
  const { confirmationDialog, spinnerDialog, configDialog, openFolderDialog } = useDialogs()
  const [openConfirmation, closeConfirmation] = confirmationDialog
  const [openSpinner, closeSpinner] = spinnerDialog
  const [openConfig] = configDialog
  const [openOpenFolder] = openFolderDialog

  const [sortOrder, setSortOrder] = useState<SortOrder>("alphabetical")
  const [filterType, setFilterType] = useState<FilterType>("all")
  const [searchQuery, setSearchQuery] = useState<string>("")
  const [isDragOver, setIsDragOver] = useState(false)
  const dragDepthRef = useRef(0)
  const pendingFolderPathRef = useRef<string | null>(null)

  const { mediaMetadatas, setSelectedMediaMetadata, addMediaMetadata } = useMediaMetadata()

  // Select folder when it's added to mediaMetadatas
  useEffect(() => {
    if (pendingFolderPathRef.current) {
      const index = mediaMetadatas.findIndex(
        (m) => m.mediaFolderPath === pendingFolderPathRef.current
      )
      if (index !== -1) {
        setSelectedMediaMetadata(index)
        pendingFolderPathRef.current = null
      }
    }
  }, [mediaMetadatas, setSelectedMediaMetadata])

  const folders: MediaFolderListItemProps[] = useMemo(() => {
    return mediaMetadatas.map((metadata) => {
      return {
        mediaName: metadata.tmdbTvShow?.name ?? (basename(metadata.mediaFolderPath!) ?? '未识别媒体名称'),
        path: metadata.mediaFolderPath,
        mediaType: metadata.type === "tvshow-folder" ? "tvshow" : metadata.type === "movie-folder" ? "movie" : "tvshow-folder",
      } as MediaFolderListItemProps
    })
  }, [mediaMetadatas])

  const filteredAndSortedFolders = useMemo(() => {
    let result = [...folders]

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim()
      result = result.filter((folder) => {
        const mediaNameMatch = folder.mediaName.toLowerCase().includes(query)
        const pathMatch = folder.path.toLowerCase().includes(query)
        const folderName = basename(folder.path) || ""
        const folderNameMatch = folderName.toLowerCase().includes(query)
        return mediaNameMatch || pathMatch || folderNameMatch
      })
    }

    // Filter by type
    if (filterType !== "all") {
      result = result.filter((folder) => folder.mediaType === filterType)
    }

    // Sort by alphabetical order
    result.sort((a, b) => {
      const comparison = a.mediaName.localeCompare(b.mediaName, undefined, { sensitivity: 'base' })
      return sortOrder === "alphabetical" ? comparison : -comparison
    })

    return result
  }, [folders,sortOrder, filterType, searchQuery])

  const handleOpenConfirmation = () => {
    openConfirmation({
      title: "Are you absolutely sure?",
      description: "This action cannot be undone.",
      content: (
        <div className="flex flex-col gap-4">
          <p>This will permanently delete your account.</p>
          <div className="flex gap-2 justify-end">
            <Button onClick={closeConfirmation} variant="outline">Cancel</Button>
            <Button onClick={closeConfirmation}>Confirm</Button>
          </div>
        </div>
      ),
      onClose: () => {
        console.log("Confirmation dialog closed")
      }
    })
  }

  const handleOpenSpinner = () => {
    openSpinner("Loading, please wait...")
    // Auto-close after 3 seconds to demonstrate it works
    setTimeout(() => {
      closeSpinner()
    }, 3000)
  }

  const handleShowToast = () => {
    toast("Event has been created", {
      description: "Sunday, December 03, 2023 at 9:00 AM",
      action: {
        label: "Undo",
        onClick: () => console.log("Undo"),
      },
    })
  }

  const handleOpenConfig = () => {
    openConfig()
  }

  const handleMediaFolderListItemClick = useCallback((path: string) => {
    const index = mediaMetadatas.findIndex((metadata) => metadata.mediaFolderPath === path)
    if (index !== -1) {
      setSelectedMediaMetadata(index)
    }
  }, [mediaMetadatas, setSelectedMediaMetadata])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.dataTransfer.types.includes('Files')) {
      e.dataTransfer.dropEffect = 'copy'
    }
  }, [])

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.dataTransfer.types.includes('Files')) {
      dragDepthRef.current++
      if (dragDepthRef.current === 1) {
        setIsDragOver(true)
      }
    }
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.dataTransfer.types.includes('Files')) {
      dragDepthRef.current--
      if (dragDepthRef.current === 0) {
        setIsDragOver(false)
      }
    }
  }, [])

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()

    setIsDragOver(false)
    dragDepthRef.current = 0

    // Check if we're in Electron environment
    const isElectron = typeof window !== 'undefined' && typeof (window as any).electron !== 'undefined'
    
    // Find the first folder (directory) in the dropped items
    let folderPath: string | null = null

    if (isElectron) {
      // In Electron, use webUtils.getPathForFile to get the file path
      const files = Array.from(e.dataTransfer.files)
      console.log('Drop event (Electron):', { filesCount: files.length, files })

      if (files.length > 0) {
        const file = files[0]
        console.log('File from Electron:', { name: file.name, type: file.type, size: file.size })
        
        // Try to get path using Electron's webUtils API via the exposed API
        const api = (window as any).api
        console.log('API object:', api)
        console.log('api.getPathForFile exists?', api && typeof api.getPathForFile === 'function')
        
        if (api && typeof api.getPathForFile === 'function') {
          try {
            console.log('Calling api.getPathForFile with file:', file)
            const filePath = api.getPathForFile(file)
            console.log('File path from api.getPathForFile:', filePath)
            if (filePath) {
              folderPath = filePath
            } else {
              console.warn('api.getPathForFile returned null or undefined')
            }
          } catch (error) {
            console.error('Error calling api.getPathForFile:', error)
          }
        } else {
          console.warn('api.getPathForFile is not available. API:', api)
        }
        
        // Fallback: try direct path property (might work in some Electron versions)
        if (!folderPath && (file as any).path) {
          folderPath = (file as any).path
          console.log('File path from file.path property:', folderPath)
        }
      }
    } else {
      // In browser, we can't directly access folder paths
      console.warn('Folder drag and drop is only supported in Electron environment')
      return
    }

    console.log('Final extracted folder path:', folderPath)

    if (!folderPath) {
      console.warn('No folder path found in dropped items. Files:', e.dataTransfer.files, 'Items:', e.dataTransfer.items)
      return
    }

    // Check if folder already exists
    const existingMetadata = mediaMetadatas.find(
      (m) => m.mediaFolderPath === folderPath
    )
    if (existingMetadata) {
      // Folder already exists, just select it
      const index = mediaMetadatas.findIndex((m) => m.mediaFolderPath === folderPath)
      if (index !== -1) {
        setSelectedMediaMetadata(index)
      }
      return
    }

    // Store folderPath in a variable that will be captured in the closure
    const droppedFolderPath = folderPath

    console.log('Opening OpenFolderDialog for path:', droppedFolderPath)

    // Open OpenFolderDialog to select folder type
    openOpenFolder(async (type: FolderType) => {
      console.log('Folder type selected:', type, 'for path:', droppedFolderPath)
      try {
        // Read media metadata for the folder
        const response = await readMediaMetadataApi(droppedFolderPath)
        const metadata = response.data

        // Set the folder type based on selection
        const folderTypeMap: Record<FolderType, "tvshow-folder" | "movie-folder" | "music-folder"> = {
          tvshow: "tvshow-folder",
          movie: "movie-folder",
          music: "music-folder"
        }
        metadata.type = folderTypeMap[type]

        // Add the metadata to the list
        addMediaMetadata(metadata)

        // Select the newly added folder
        pendingFolderPathRef.current = droppedFolderPath
      } catch (error) {
        console.error('Failed to read media metadata:', error)
      }
    }, droppedFolderPath)
  }, [mediaMetadatas, openOpenFolder, addMediaMetadata, setSelectedMediaMetadata])

  return (
    <div 
      className="flex min-h-svh flex-col relative"
      onDragOver={handleDragOver}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Drag and Drop Overlay */}
      {isDragOver && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/90 backdrop-blur-md transition-opacity duration-200">
          <div className="flex flex-col items-center justify-center gap-6 p-16 rounded-2xl border-4 border-dashed border-primary bg-primary/10 shadow-2xl transform transition-all duration-300 scale-100">
            <div className="relative">
              <div className="absolute inset-0 bg-primary/20 rounded-full blur-xl animate-pulse" />
              <FolderOpen className="h-20 w-20 text-primary relative z-10 animate-bounce" />
              <Upload className="h-10 w-10 text-primary absolute -top-3 -right-3 bg-background rounded-full p-2 border-4 border-primary shadow-lg z-10" />
            </div>
            <div className="text-center space-y-3">
              <h3 className="text-3xl font-bold text-foreground">Drop Folder Here</h3>
              <p className="text-base text-muted-foreground max-w-md">
                Release the folder to add it to your media library and select its type
              </p>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
              <span>Ready to receive folder</span>
            </div>
          </div>
        </div>
      )}
      
      <ThreeColumnLayout className="flex flex-col flex-1">
        <LeftSidebarContent>
          <Menu/>
          <MediaFolderToolbar
            sortOrder={sortOrder}
            onSortOrderChange={setSortOrder}
            filterType={filterType}
            onFilterTypeChange={setFilterType}
          />
          <div className="p-1">
            <SearchForm 
              value={searchQuery}
              onValueChange={setSearchQuery}
              placeholder="Search media folders..."
            />
          </div>
          <div className="flex flex-col gap-4 p-4">
            {filteredAndSortedFolders.map((folder) => (
              <MediaFolderListItem key={folder.path} {...folder} onClick={() => handleMediaFolderListItemClick(folder.path)} />
            ))}
          </div>
        </LeftSidebarContent>
        <SidebarContent>
          {
            folders.length === 0 && <Welcome />
          } 
          {folders.length > 0 && <TvShowPanel />}
          {/* <div className="flex flex-col gap-4 p-4">
            <Button onClick={handleOpenConfirmation}>Open Confirmation Dialog</Button>
            <Button onClick={handleOpenSpinner}>Open Spinner Dialog</Button>
            <Button onClick={handleShowToast}>Show Toast</Button>
            <Button onClick={handleOpenConfig}>Open Config Dialog</Button>
          </div> */}
        </SidebarContent>
        <RightSidebarContent>
          <div className="w-full h-full">
          <AiChatbox />
          </div>
        </RightSidebarContent>
      </ThreeColumnLayout>

      <StatusBar />
    </div>
  )
}

function App() {
  return (
    <ThemeProvider defaultTheme="system" storageKey="vite-ui-theme">
      <ConfigProvider>
        <DialogProvider>
          <MediaMetadataProvider>
          <AppLayout />
          </MediaMetadataProvider>
          <Toaster position="bottom-right" />
        </DialogProvider>
      </ConfigProvider>
    </ThemeProvider>
  )
}

export default App