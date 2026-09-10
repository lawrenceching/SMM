import type { ReactNode } from "react"
import { Menu } from "@/components/menu"
import { Button } from "@/components/ui/button"
import { Bot } from "lucide-react"

export interface ToolbarProps {
  onOpenFolderMenuClick?: () => void
  onOpenMediaLibraryMenuClick?: () => void
  onToggleAIArea?: () => void
  isAIAreaCollapsed?: boolean
  /** Extra controls rendered in the right group, before the AI toggle. */
  children?: ReactNode
}

export function Toolbar({
  onOpenFolderMenuClick,
  onOpenMediaLibraryMenuClick,
  onToggleAIArea,
  isAIAreaCollapsed,
  children,
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
        {children}
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
