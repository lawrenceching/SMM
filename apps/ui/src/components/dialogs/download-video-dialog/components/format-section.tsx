import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  YTDLP_FORMAT_PRESETS,
  ytdlpFormatPresetLabelKey,
  type YtdlpFormatPresetId,
} from "@/lib/ytdlpFormatPresets"

export interface FormatSectionProps {
  isUrlValid: boolean
  selectedFormatPresetId: YtdlpFormatPresetId
  is1080pAvailable: boolean
  formBusy: boolean
  onFormatChange: (id: YtdlpFormatPresetId) => void
  t: (key: string) => string
}

export function FormatSection({
  isUrlValid,
  selectedFormatPresetId,
  is1080pAvailable,
  formBusy,
  onFormatChange,
  t,
}: FormatSectionProps) {
  if (!isUrlValid) return null

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor="download-format">{t("downloadVideo.formatLabel")}</Label>
      <Select
        value={selectedFormatPresetId}
        onValueChange={(value) => onFormatChange(value as YtdlpFormatPresetId)}
        disabled={formBusy}
      >
        <SelectTrigger
          id="download-format"
          data-testid="download-video-dialog-format-select"
          className="w-full max-w-full"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {YTDLP_FORMAT_PRESETS.map((preset) => {
            const baseLabel = t(ytdlpFormatPresetLabelKey(preset.id))
            const label =
              preset.id === "1080p" && !is1080pAvailable
                ? `${baseLabel}${t("downloadVideo.formatUnavailableSuffix")}`
                : baseLabel
            return (
              <SelectItem
                key={preset.id}
                value={preset.id}
                data-testid={`download-video-dialog-format-option-${preset.id}`}
              >
                {label}
              </SelectItem>
            )
          })}
        </SelectContent>
      </Select>
    </div>
  )
}
