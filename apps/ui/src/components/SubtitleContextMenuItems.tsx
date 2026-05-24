import {
  ContextMenuItem,
} from "@/components/ui/context-menu"
import { CircleStop, Captions, Languages, FileVideo, Sparkles } from "lucide-react"
import { useTranslation } from "@/lib/i18n"
import type { LocalFileTableRowSubtitleActions } from "@/types/music-table"
import type { RowSubtitleUi } from "@/hooks/useMusicFolderSubtitlePipeline"

interface SubtitleContextMenuItemsProps {
  subtitleUi: RowSubtitleUi
  subtitleActions: LocalFileTableRowSubtitleActions
}

export function SubtitleContextMenuItems({
  subtitleUi,
  subtitleActions,
}: SubtitleContextMenuItemsProps) {
  const { t } = useTranslation(["components"])
  return (
    <>
      {subtitleUi.transcribeStatus === "running" && (
        <ContextMenuItem onClick={subtitleActions.onTranscribeStop}>
          <CircleStop className="mr-2 size-4" />
          {t("mediaPlayer.trackContextMenu.transcribeStop")}
        </ContextMenuItem>
      )}
      <ContextMenuItem
        disabled={subtitleUi.transcribeStartDisabled}
        onClick={subtitleActions.onTranscribe}
      >
        <Captions className="mr-2 size-4" />
        {t("mediaPlayer.trackContextMenu.transcribe")}
      </ContextMenuItem>
      {subtitleUi.translateStatus === "running" && (
        <ContextMenuItem onClick={subtitleActions.onTranslateStop}>
          <CircleStop className="mr-2 size-4" />
          {t("mediaPlayer.trackContextMenu.translateStop")}
        </ContextMenuItem>
      )}
      <ContextMenuItem
        disabled={subtitleUi.translateStartDisabled}
        onClick={subtitleActions.onTranslate}
      >
        <Languages className="mr-2 size-4" />
        {t("mediaPlayer.trackContextMenu.translate")}
      </ContextMenuItem>
      {subtitleUi.synthesizeStatus === "running" && (
        <ContextMenuItem onClick={subtitleActions.onSynthesizeStop}>
          <CircleStop className="mr-2 size-4" />
          {t("mediaPlayer.trackContextMenu.synthesizeStop")}
        </ContextMenuItem>
      )}
      <ContextMenuItem
        disabled={subtitleUi.synthesizeStartDisabled}
        onClick={subtitleActions.onSynthesize}
      >
        <FileVideo className="mr-2 size-4" />
        {t("mediaPlayer.trackContextMenu.synthesize")}
      </ContextMenuItem>
      {subtitleUi.processStatus === "running" && (
        <ContextMenuItem onClick={subtitleActions.onProcessStop}>
          <CircleStop className="mr-2 size-4" />
          {t("mediaPlayer.trackContextMenu.processStop")}
        </ContextMenuItem>
      )}
      <ContextMenuItem
        disabled={subtitleUi.processStartDisabled}
        onClick={subtitleActions.onProcess}
      >
        <Sparkles className="mr-2 size-4" />
        {t("mediaPlayer.trackContextMenu.process")}
      </ContextMenuItem>
    </>
  )
}
