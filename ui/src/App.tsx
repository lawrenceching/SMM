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

function AppLayout() {
  const { confirmationDialog, spinnerDialog } = useDialogs()
  const [openConfirmation, closeConfirmation] = confirmationDialog
  const [openSpinner, closeSpinner] = spinnerDialog

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

  return (
    <div className="flex min-h-svh flex-col">
      <ThreeColumnLayout className="flex flex-col flex-1">
        <LeftSidebarContent>
          <Menu/>
          <SearchForm />
        </LeftSidebarContent>
        <SidebarContent>
          <div className="flex flex-col gap-4 p-4">
            <Button onClick={handleOpenConfirmation}>Open Confirmation Dialog</Button>
            <Button onClick={handleOpenSpinner}>Open Spinner Dialog</Button>
            <Button onClick={handleShowToast}>Show Toast</Button>
          </div>
        </SidebarContent>
        <RightSidebarContent>
          <div className="w-full h-full">
          <AiChatbox />
          </div>
        </RightSidebarContent>
      </ThreeColumnLayout>

      <StatusBar className="bg-gray-400"/>
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