
import { Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupLabel, SidebarHeader, SidebarProvider, SidebarTrigger } from "./sidebar"


function ConfigPanelSidebar() {
    return <Sidebar collapsible="none">
    <SidebarHeader />
    <SidebarContent>
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
    <div>
        <SidebarProvider>
      <ConfigPanelSidebar />
      <main>
        <SidebarTrigger />
        <div>
            <h1>Config Panel</h1>
        </div>
      </main>
    </SidebarProvider>
    </div>
  )
}

export { ConfigPanel }