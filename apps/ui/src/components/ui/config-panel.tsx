import { useState } from "react"
import { Settings, Bot, FileText, MessageSquare } from "lucide-react"
import { Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupLabel, SidebarHeader, SidebarProvider, SidebarTrigger, SidebarMenu, SidebarMenuItem, SidebarMenuButton } from "./sidebar"
import { GeneralSettings } from "./settings/GeneralSettings"
import { AiSettings } from "./settings/AiSettings"
import { Feedback } from "./settings/Feedback"
import { useTranslation } from "@/lib/i18n"

export type SettingsTab = "general" | "ai" | "rename-rules" | "feedback"

interface ConfigPanelSidebarProps {
  activeTab: SettingsTab
  onTabChange: (tab: SettingsTab) => void
}

function ConfigPanelSidebar({ activeTab, onTabChange }: ConfigPanelSidebarProps) {
  const { t } = useTranslation('settings')

  const menuItems: Array<{ id: SettingsTab; label: string; icon: React.ReactNode }> = [
    { id: "general", label: t('sidebar.general'), icon: <Settings className="h-4 w-4" /> },
    { id: "ai", label: t('sidebar.ai'), icon: <Bot className="h-4 w-4" /> },
    // Disable Rename Rules as this feature is going to deprecate
    // { id: "rename-rules", label: t('sidebar.renameRules'), icon: <FileText className="h-4 w-4" /> },
    { id: "feedback", label: t('sidebar.feedback'), icon: <MessageSquare className="h-4 w-4" /> },
  ]

  return (
    <Sidebar collapsible="none" className="border-r h-full flex flex-col" data-testid="config-sidebar">
      <SidebarHeader />
      <SidebarContent className="flex-1">
        <SidebarGroup>
          <SidebarGroupLabel>{t('sidebar.title')}</SidebarGroupLabel>
          <SidebarMenu>
            {menuItems.map((item) => (
              <SidebarMenuItem key={item.id}>
                <SidebarMenuButton
                  isActive={activeTab === item.id}
                  onClick={() => onTabChange(item.id)}
                  data-testid={`config-tab-${item.id}`}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter />
    </Sidebar>
  )
}

interface ConfigPanelProps {
  initialTab?: SettingsTab
}

function ConfigPanel({ initialTab = "general" }: ConfigPanelProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>(initialTab)

  const renderContent = () => {
    switch (activeTab) {
      case "general":
        return <GeneralSettings />
      case "ai":
        return <AiSettings />
      case "feedback":
        return <Feedback />
      default:
        return <GeneralSettings />
    }
  }

  return (
    <div className="h-full w-full flex flex-col">
      <SidebarProvider className="h-full flex flex-col" style={{ minHeight: 0 }}>
        <div className="flex h-full w-full">
          <ConfigPanelSidebar activeTab={activeTab} onTabChange={setActiveTab} />
          <main className="flex-1 flex flex-col min-w-0">
            <div className="border-b p-4">
              <SidebarTrigger />
            </div>
            <div className="flex-1 overflow-auto">
              {renderContent()}
            </div>
          </main>
        </div>
      </SidebarProvider>
    </div>
  )
}

export { ConfigPanel }