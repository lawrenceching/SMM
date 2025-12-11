
import { Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupLabel, SidebarHeader, SidebarProvider, SidebarTrigger } from "./sidebar"


function ConfigPanelSidebar() {
    return <Sidebar collapsible="none" className="border-r h-full flex flex-col">
    <SidebarHeader />
    <SidebarContent className="flex-1">
      <SidebarGroup>
        <SidebarGroupLabel>
            <h1>Config Panel</h1>
        </SidebarGroupLabel>
      </SidebarGroup>
    </SidebarContent>
    <SidebarFooter />
  </Sidebar>
}

function ConfigPanel() {
  return (
    <div className="h-full w-full flex flex-col">
      <SidebarProvider className="h-full flex flex-col" style={{ minHeight: 0 }}>
        <div className="flex h-full w-full">
          <ConfigPanelSidebar />
          <main className="flex-1 flex flex-col min-w-0">
            <SidebarTrigger />
            <div className="flex-1 overflow-auto">
              <h1>Config Panel</h1>
            </div>
          </main>
        </div>
      </SidebarProvider>
    </div>
  )
}

export { ConfigPanel }