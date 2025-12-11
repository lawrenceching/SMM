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
import { useMemo } from "react"
import { basename } from "./lib/path"


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
}

const folders: MediaFolderListItemProps[] = [
  {
    mediaName: "The Simpsons",
    path: "/Users/john/Downloads/The Simpsons [2025][1080P]",
    mediaType: 'tvshow'
  },
  {
    mediaName: "Super Hero",
    path: "/Users/john/Downloads/Super Hero [2025][1080P]",
    mediaType: 'movie'
  },
  {
    mediaName: "Bilibili Music",
    path: "/Users/john/Downloads/music",
    mediaType: 'music'
  }
]

function MediaFolderListItem(folder: MediaFolderListItemProps) {

  const fallbackThumbnail = useMemo(() => {
    switch (folder.mediaType) {
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
  }, [folder.mediaType])

  const folderName = useMemo(() => {
    return basename(folder.path)
  }, [folder.path])

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <img src={fallbackThumbnail} alt={folder.mediaName} className="w-10 h-10 rounded-md" />
        <div>
          <h5 className="text-sm font-bold">{folder.mediaName}</h5>
          <p className="text-sm text-gray-500">{folderName}</p>
        </div>
      </div>
    </div>
  )
}

function AppLayout() {
  const { confirmationDialog, spinnerDialog, configDialog } = useDialogs()
  const [openConfirmation, closeConfirmation] = confirmationDialog
  const [openSpinner, closeSpinner] = spinnerDialog
  const [openConfig] = configDialog

  

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

  return (
    <div className="flex min-h-svh flex-col">
      <ThreeColumnLayout className="flex flex-col flex-1">
        <LeftSidebarContent>
          <Menu/>
          <SearchForm />
          <div className="flex flex-col gap-4 p-4">
            {folders.map((folder) => (
              <MediaFolderListItem key={folder.path} {...folder} />
            ))}
          </div>
        </LeftSidebarContent>
        <SidebarContent>
          <div className="flex flex-col gap-4 p-4">
            <Button onClick={handleOpenConfirmation}>Open Confirmation Dialog</Button>
            <Button onClick={handleOpenSpinner}>Open Spinner Dialog</Button>
            <Button onClick={handleShowToast}>Show Toast</Button>
            <Button onClick={handleOpenConfig}>Open Config Dialog</Button>
          </div>
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
          <AppLayout />
          <Toaster position="bottom-right" />
        </DialogProvider>
      </ConfigProvider>
    </ThemeProvider>
  )
}

export default App