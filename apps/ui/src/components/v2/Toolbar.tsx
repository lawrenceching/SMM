import { Menu } from "@/components/menu"
import { ViewSwitcher, type ViewMode } from "./ViewSwitcher"

export interface ToolbarProps {
  onOpenFolderMenuClick?: () => void
  onOpenMediaLibraryMenuClick?: () => void
  viewMode?: ViewMode
  onViewModeChange?: (mode: ViewMode) => void
  viewSwitcherDisabled?: boolean
}

export function Toolbar({ 
  onOpenFolderMenuClick,
  onOpenMediaLibraryMenuClick,
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
      <Menu onOpenFolderMenuClick={onOpenFolderMenuClick} onOpenMediaLibraryMenuClick={onOpenMediaLibraryMenuClick} />
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

