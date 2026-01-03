import { Button } from "@/components/ui/button"
import { LayoutGrid, FolderOpen } from "lucide-react"
import { cn } from "@/lib/utils"

export type ViewMode = "metadata" | "files"

export interface ViewSwitcherProps {
  viewMode: ViewMode
  onViewModeChange: (mode: ViewMode) => void
  disabled?: boolean
}

export function ViewSwitcher({ viewMode, onViewModeChange, disabled }: ViewSwitcherProps) {
  return (
    <div className="inline-flex items-center rounded-md border border-input bg-background shadow-xs">
      <Button
        variant="ghost"
        size="icon"
        onClick={() => onViewModeChange("metadata")}
        disabled={disabled}
        className={cn(
          "h-8 w-8 rounded-none rounded-l-md",
          viewMode === "metadata" && "bg-accent text-accent-foreground",
          "hover:bg-accent hover:text-accent-foreground"
        )}
        title="Metadata View"
      >
        <LayoutGrid className="h-4 w-4" />
        <span className="sr-only">Metadata View</span>
      </Button>
      <div className="h-4 w-px bg-border" />
      <Button
        variant="ghost"
        size="icon"
        onClick={() => onViewModeChange("files")}
        disabled={disabled}
        className={cn(
          "h-8 w-8 rounded-none rounded-r-md",
          viewMode === "files" && "bg-accent text-accent-foreground",
          "hover:bg-accent hover:text-accent-foreground"
        )}
        title="Files View"
      >
        <FolderOpen className="h-4 w-4" />
        <span className="sr-only">Files View</span>
      </Button>
    </div>
  )
}

