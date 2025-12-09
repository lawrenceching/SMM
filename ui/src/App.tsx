import type { AppConfig } from "@core/types"
import { ThreeColumnLayout, LeftSidebarContent, RightSidebarContent, SidebarContent } from "@/components/three-column-layout"
import { SearchForm } from "./components/search-form"
import { Menu } from "./components/menu"
import { StatusBar } from "./components/StatusBar"
import { ConfigProvider } from "./components/config-provider"
import { ThemeProvider } from "./components/theme-provider"

const appConfig: AppConfig = {
  version: "0.0.1"
}

function AppLayout() {
  return (
    <div className="flex min-h-svh flex-col">
      <ThreeColumnLayout className="flex flex-col flex-1">
        <LeftSidebarContent>
          <Menu/>
          <SearchForm />
        </LeftSidebarContent>
        <SidebarContent>
          {/* Main content area */}
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
        <AppLayout />
      </ConfigProvider>
    </ThemeProvider>
  )
}

export default App