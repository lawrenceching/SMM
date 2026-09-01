import { Button } from "@/components/ui/button"
import { LayoutGrid, FolderOpen } from "lucide-react"
import { cn } from "@/lib/utils"
import { useTranslation } from "@/lib/i18n"

export type ViewMode = "metadata" | "files"

export interface ViewSwitcherProps {
  viewMode: ViewMode
  onViewModeChange: (mode: ViewMode) => void
  disabled?: boolean
}

export function ViewSwitcher({ viewMode, onViewModeChange, disabled }: ViewSwitcherProps) {
  const { t } = useTranslation('components')
  const metadataViewLabel = t('viewSwitcher.metadataView')
  const filesViewLabel = t('viewSwitcher.filesView')
  
  return (
    <div className="inline-flex items-center rounded-md border border-input bg-background shadow-xs">
      <Button
        variant="ghost"
        size="icon"
        onClick={() => onViewModeChange("metadata")}
        disabled={disabled}
        className={cn(
          "h-8 w-8 rounded-none rounded-l-md transition-all",
          viewMode === "metadata" 
            ? "bg-primary text-primary-foreground shadow-sm ring-1 ring-primary/20" 
            : "hover:bg-accent hover:text-accent-foreground"
        )}
        title={metadataViewLabel}
        aria-pressed={viewMode === "metadata"}
      >
        <LayoutGrid className="h-4 w-4" />
        <span className="sr-only">{metadataViewLabel}</span>
      </Button>
      <div className="h-4 w-px bg-border" />
      <Button
        variant="ghost"
        size="icon"
        onClick={() => onViewModeChange("files")}
        disabled={disabled}
        className={cn(
          "h-8 w-8 rounded-none rounded-r-md transition-all",
          viewMode === "files" 
            ? "bg-primary text-primary-foreground shadow-sm ring-1 ring-primary/20" 
            : "hover:bg-accent hover:text-accent-foreground"
        )}
        title={filesViewLabel}
        aria-pressed={viewMode === "files"}
      >
        <FolderOpen className="h-4 w-4" />
        <span className="sr-only">{filesViewLabel}</span>
      </Button>
    </div>
  )
}

