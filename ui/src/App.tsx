import type { AppConfig } from "@core/types"
import { Layout, LeftSidebarContent, RightSidebarContent, SidebarContent } from "@/components/layout"
import { SearchForm } from "./components/search-form"
import { Menu } from "./components/menu"

const appConfig: AppConfig = {
  version: "0.0.1"
}

function App() {
  return (
    <div className="flex min-h-svh flex-col">
      
      <Layout className="flex flex-col flex-1">
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
      </Layout>
      
      <div className="h-[30px] w-full bg-gray-400 flex">
        <div className="flex-1"></div>
        <div className="max-w-[60px]">{appConfig.version}</div>
      </div>
    </div>
  )
}

export default App