import { Menu } from "@/components/menu"

export interface ToolbarProps {
  onOpenFolderMenuClick?: () => void
}

export function Toolbar({ onOpenFolderMenuClick }: ToolbarProps) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        height: "100%",
        padding: "0 0px",
      }}
    >
      <Menu onOpenFolderMenuClick={onOpenFolderMenuClick} />
    </div>
  )
}

