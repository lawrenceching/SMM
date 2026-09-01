import { Menu } from "@/components/menu"
import { ViewSwitcher, type ViewMode } from "./ViewSwitcher"
import { Button } from "@/components/ui/button"
import { Bot } from "lucide-react"

export interface ToolbarProps {
  onOpenFolderMenuClick?: () => void
  onOpenMediaLibraryMenuClick?: () => void
  viewMode?: ViewMode
  onViewModeChange?: (mode: ViewMode) => void
  viewSwitcherDisabled?: boolean
  onToggleAIArea?: () => void
  isAIAreaCollapsed?: boolean
}

export function Toolbar({ 
  onOpenFolderMenuClick,
  onOpenMediaLibraryMenuClick,
  viewMode, 
  onViewModeChange, 
  viewSwitcherDisabled,
  onToggleAIArea,
  isAIAreaCollapsed,
}: ToolbarProps) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        height: "100%",
        padding: "0 0px",
        width: "100%",
      }}
    >
      <Menu onOpenFolderMenuClick={onOpenFolderMenuClick} onOpenMediaLibraryMenuClick={onOpenMediaLibraryMenuClick} />
      <div className="flex items-center gap-1.5">
        {viewMode !== undefined && onViewModeChange && (
          <ViewSwitcher 
            viewMode={viewMode} 
            onViewModeChange={onViewModeChange}
            disabled={viewSwitcherDisabled}
          />
        )}
        {onToggleAIArea && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggleAIArea}
            className="h-8 w-8"
            title={isAIAreaCollapsed ? "打開AI區域" : "關閉AI區域"}
          >
            <Bot className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  )
}

