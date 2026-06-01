import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu"
import { FolderOpen } from "lucide-react"
import { useTranslation } from "@/lib/i18n"
import { basename } from "@/lib/path"
import type { AssociatedFile } from "@/types/associated-files"
import type { LocalFileTableRowSubtitleActions } from "@/types/music-table"
import type { RowSubtitleUi } from "@/hooks/useMusicFolderSubtitlePipeline"
import { SubtitleContextMenuItems } from "./SubtitleContextMenuItems"

const subgridRowStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "subgrid",
  gridColumn: "1 / -1",
}

export interface AssociatedFileRowProps {
  file: AssociatedFile
  subtitleActions?: LocalFileTableRowSubtitleActions
  subtitleUi?: RowSubtitleUi
  onOpen?: () => void
}

export function AssociatedFileRow({ file, subtitleActions, subtitleUi, onOpen }: AssociatedFileRowProps) {
  const { t } = useTranslation(["components"])
  const name = basename(file.path) ?? file.path

  const label = (() => {
    switch (file.type) {
      case "subtitle":
        return t("associatedFiles.type.subtitle")
      case "audio":
        return t("associatedFiles.type.audio")
      case "thumbnail":
        return t("associatedFiles.type.thumbnail")
      case "summary":
        return t("associatedFiles.type.summary")
    }
  })()

  const showSubtitleMenu = file.type === "subtitle" && subtitleActions && subtitleUi

  const row = (
    <div
      style={subgridRowStyle}
      role="row"
      className="text-xs text-muted-foreground cursor-pointer hover:bg-muted/50"
      onDoubleClick={() => onOpen?.()}
      title={t("mediaPlayer.trackContextMenu.open")}
    >
      <div role="cell" />
      <div role="cell" className="flex items-center justify-center py-1">
        {label}
      </div>
      <div
        role="cell"
        className="col-span-3 flex items-center py-1 pl-2 truncate"
        title={name}
      >
        {name}
      </div>
      <div role="cell" />
    </div>
  )

  const openMenuItem = onOpen && (
    <ContextMenuItem onClick={onOpen}>
      <FolderOpen className="mr-2 size-4" />
      {t("mediaPlayer.trackContextMenu.open")}
    </ContextMenuItem>
  )

  if (!showSubtitleMenu && !openMenuItem) return row

  if (showSubtitleMenu) {
    return (
      <ContextMenu>
        <ContextMenuTrigger asChild>{row}</ContextMenuTrigger>
        <ContextMenuContent>
          {openMenuItem}
          <SubtitleContextMenuItems
            subtitleUi={subtitleUi}
            subtitleActions={subtitleActions}
          />
        </ContextMenuContent>
      </ContextMenu>
    )
  }

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{row}</ContextMenuTrigger>
      <ContextMenuContent>
        {openMenuItem}
      </ContextMenuContent>
    </ContextMenu>
  )
}
