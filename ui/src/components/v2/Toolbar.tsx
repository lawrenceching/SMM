import { Menu } from "@/components/menu"
import { ViewSwitcher, type ViewMode } from "./ViewSwitcher"

export interface ToolbarProps {
  onOpenFolderMenuClick?: () => void
  viewMode?: ViewMode
  onViewModeChange?: (mode: ViewMode) => void
  viewSwitcherDisabled?: boolean
}

export function Toolbar({ 
  onOpenFolderMenuClick, 
  viewMode, 
  onViewModeChange, 
  viewSwitcherDisabled 
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
      <Menu onOpenFolderMenuClick={onOpenFolderMenuClick} />
      {viewMode !== undefined && onViewModeChange && (
        <ViewSwitcher 
          viewMode={viewMode} 
          onViewModeChange={onViewModeChange}
          disabled={viewSwitcherDisabled}
        />
      )}
    </div>
  )
}

