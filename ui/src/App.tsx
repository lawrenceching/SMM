import type { AppConfig } from "@core/types"
import { ThreeColumnLayout, LeftSidebarContent, RightSidebarContent, SidebarContent } from "@/components/three-column-layout"
import { SearchForm } from "./components/search-form"
import { Menu } from "./components/menu"
import { StatusBar } from "./components/StatusBar"
import { ConfigProvider } from "./components/config-provider"
import { ThemeProvider } from "./components/theme-provider"
import { DialogProvider, useDialogs } from "./components/dialog-provider"
import { Button } from "./components/ui/button"

const appConfig: AppConfig = {
  version: "0.0.1"
}

function AppLayout() {

  
  const { openDialog, closeDialog } = useDialogs()

  const handleOpen = () => {
    openDialog({
      title: "Are you absolutely sure?",
      description: "This action cannot be undone.",
      content: (
        <div>
          <p>This will permanently delete your account.</p>
          <Button onClick={closeDialog}>Cancel</Button>
          <Button onClick={closeDialog}>Confirm</Button>
        </div>
      ),
      onClose: () => {
        console.log("Dialog closed")
      }
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
        <Button onClick={handleOpen}>Open Dialog</Button>
        </SidebarContent>
        <RightSidebarContent>
          Right SideBar
        </RightSidebarContent>
      </ThreeColumnLayout>

      <StatusBar className="bg-gray-400"/>
    </div>
  )
}

function App() {
  return (
    <ThemeProvider defaultTheme="system" storageKey="vite-ui-theme">
      <ConfigProvider appConfig={appConfig}>
        <DialogProvider>
          <AppLayout />
        </DialogProvider>
      </ConfigProvider>
    </ThemeProvider>
  )
}

export default App