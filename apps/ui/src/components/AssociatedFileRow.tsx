import { useCallback } from "react"
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu"
import { FolderOpen } from "lucide-react"
import { useTranslation } from "@/lib/i18n"
import { basename } from "@/lib/path"
import { openFile } from "@/api/openFile"
import { Path } from "@core/path"
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
}

export function AssociatedFileRow({ file, subtitleActions, subtitleUi }: AssociatedFileRowProps) {
  const { t } = useTranslation(["components"])
  const name = basename(file.path) ?? file.path

  const handleOpen = useCallback(() => {
    const platformPath = Path.toPlatformPath(file.path)
    openFile(platformPath).catch((error) => {
      console.error('[AssociatedFileRow] Failed to open file:', error)
    })
  }, [file.path])

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
      className="text-xs text-muted-foreground cursor-pointer hover:bg-muted/50 select-none"
      onDoubleClick={handleOpen}
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

  if (!showSubtitleMenu) {
    // Non-subtitle files: only show the "Open" context menu
    return (
      <ContextMenu>
        <ContextMenuTrigger asChild>{row}</ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem onClick={handleOpen}>
            <FolderOpen className="mr-2 size-4" />
            {t("mediaPlayer.trackContextMenu.open")}
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    )
  }

  // Subtitle files: show "Open" action followed by subtitle-specific actions
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{row}</ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem onClick={handleOpen}>
          <FolderOpen className="mr-2 size-4" />
          {t("mediaPlayer.trackContextMenu.open")}
        </ContextMenuItem>
        <SubtitleContextMenuItems
          subtitleUi={subtitleUi}
          subtitleActions={subtitleActions}
        />
      </ContextMenuContent>
    </ContextMenu>
  )
}
