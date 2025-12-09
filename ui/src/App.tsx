import { AppSidebar } from "@/components/app-sidebar"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Separator } from "@/components/ui/separator"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { Button } from "@/components/ui/button"
import type { AppConfig } from "@core/types"
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable"
const appConfig: AppConfig = {
  version: "0.0.1"
}

function App() {
  return (
    <div className="flex min-h-svh flex-col ">
      <div className="flex-1 bg-amber-200 flex flex-col">

      <ResizablePanelGroup
      direction="horizontal"
      className="border bg-amber-600 h-full w-full flex-1"
    >
      <ResizablePanel defaultSize={20} minSize={20} maxSize={40}>
        <div className="flex h-full bg-amber-300 items-center justify-center p-6">
          Left Sidebar
        </div>
      </ResizablePanel>
      <ResizableHandle />
      <ResizablePanel defaultSize={80}>
        <ResizablePanelGroup direction="horizontal">
          <ResizablePanel defaultSize={60}>
            <div className="flex h-full items-center justify-center p-6">
              Content
            </div>
          </ResizablePanel>
          <ResizableHandle />
          <ResizablePanel defaultSize={40} minSize={30} maxSize={40}>
            <div className="flex h-full items-center justify-center p-6">
              Right SideBar
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      </ResizablePanel>
    </ResizablePanelGroup>

      

      </div>
      <div className="h-[30px] w-full bg-gray-400 flex">
        <div className="flex-1"></div>
        <div className="max-w-[60px]">{appConfig.version}</div>
      </div>
    </div>
  )
}

export default App