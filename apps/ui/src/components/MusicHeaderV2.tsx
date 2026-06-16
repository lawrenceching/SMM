import { Captions, ChevronDown, Download, FileVideo, Languages, Music, Sparkles } from "lucide-react"
import { Button } from "./ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu"
import { useTranslation } from "@/lib/i18n"
import type { MediaMetadata } from "@core/types"

export interface MusicHeaderV2Props {
  selectedMediaMetadata?: MediaMetadata
  onDownloadClick?: () => void
  onTranscribeClick?: () => void
  onTranslateClick?: () => void
  isTranscribeAvailable?: boolean
  /** At least one music file row can be transcribed (resolvable path). */
  hasTranscribeTargets?: boolean
  isTranslateAvailable?: boolean
  hasTranslateTargets?: boolean
  onSynthesizeClick?: () => void
  isSynthesizeAvailable?: boolean
  hasSynthesizeTargets?: boolean
  onProcessClick?: () => void
  isProcessAvailable?: boolean
  hasProcessTargets?: boolean
  /** When false, subtitle dropdown is hidden (e.g. HarmonyOS). */
  showSubtitleMenu?: boolean
  /** When false, download button is hidden (e.g. HarmonyOS). */
  showDownloadButton?: boolean
  isMultiSelectMode?: boolean
  onToggleMultiSelectMode?: () => void
}

export function MusicHeaderV2({
  selectedMediaMetadata,
  onDownloadClick,
  onTranscribeClick,
  onTranslateClick,
  isTranscribeAvailable = false,
  hasTranscribeTargets = false,
  isTranslateAvailable = false,
  hasTranslateTargets = false,
  onSynthesizeClick,
  isSynthesizeAvailable = false,
  hasSynthesizeTargets = false,
  onProcessClick,
  isProcessAvailable = false,
  hasProcessTargets = false,
  showSubtitleMenu = true,
  showDownloadButton = true,
  isMultiSelectMode = false,
  onToggleMultiSelectMode,
}: MusicHeaderV2Props) {
  const { t } = useTranslation(["components", "common"])

  const folderName = selectedMediaMetadata?.mediaFolderPath?.split("/").pop() || "Music"
  const trackCount = selectedMediaMetadata?.files?.length ?? 0
  const folderReady = !!selectedMediaMetadata?.mediaFolderPath

  const transcribeDisabled =
    !folderReady || !isTranscribeAvailable || !hasTranscribeTargets
  const translateDisabled = !folderReady || !isTranslateAvailable || !hasTranslateTargets
  const synthesizeDisabled = !folderReady || !isSynthesizeAvailable || !hasSynthesizeTargets
  const processDisabled = !folderReady || !isProcessAvailable || !hasProcessTargets
  const subtitleDisabled = transcribeDisabled && translateDisabled && synthesizeDisabled && processDisabled

  return (
    <div className="relative w-full space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <Music className="size-5 text-muted-foreground" />
            <h1 data-testid="music-panel-title" className="text-lg font-semibold truncate">
              {folderName}
            </h1>
            <span className="text-sm text-muted-foreground">
              ({trackCount} {trackCount === 1 ? "track" : "tracks"})
            </span>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap shrink-0">
          <Button
            variant={isMultiSelectMode ? "destructive" : "outline"}
            size="sm"
            onClick={() => onToggleMultiSelectMode?.()}
            disabled={!folderReady}
            data-testid="music-multi-select-toggle"
          >
            {isMultiSelectMode ? t("cancel", { ns: "common" }) : t("mediaPlayer.select")}
          </Button>
          {showSubtitleMenu && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                disabled={!folderReady || subtitleDisabled}
                data-testid="music-header-subtitle"
              >
                <Captions className="mr-2 size-4" />
                {t("mediaPlayer.trackContextMenu.subtitle")}
                <ChevronDown className="ml-1 size-4 opacity-60" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem
                disabled={transcribeDisabled}
                onClick={() => onTranscribeClick?.()}
                data-testid="music-multi-select-transcribe"
              >
                <Captions className="mr-2 size-4" />
                {t("mediaPlayer.trackContextMenu.transcribe", { defaultValue: "Transcribe" })}
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={translateDisabled}
                onClick={() => onTranslateClick?.()}
                data-testid="music-header-translate"
              >
                <Languages className="mr-2 size-4" />
                {t("mediaPlayer.trackContextMenu.translate")}
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={synthesizeDisabled}
                onClick={() => onSynthesizeClick?.()}
                data-testid="music-header-synthesize"
              >
                <FileVideo className="mr-2 size-4" />
                {t("mediaPlayer.trackContextMenu.synthesize")}
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={processDisabled}
                onClick={() => onProcessClick?.()}
                data-testid="music-header-process"
              >
                <Sparkles className="mr-2 size-4" />
                {t("mediaPlayer.trackContextMenu.process")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          )}
          {showDownloadButton && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => onDownloadClick?.()}
            disabled={!folderReady}
            data-testid="music-download-button"
          >
            <Download className="mr-2 size-4" />
            {t("mediaPlayer.download")}
          </Button>
          )}
        </div>
      </div>
    </div>
  )
}
