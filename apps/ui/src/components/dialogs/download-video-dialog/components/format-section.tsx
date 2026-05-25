import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
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
  type YtdlpFormatMode,
  type YtdlpFormatPresetId,
} from "@/lib/ytdlpFormatPresets"
import { groupFormatsByCategory, type YtdlpFormatCodeEntry } from "@/lib/ytdlpFormatCodes"

export interface FormatSectionProps {
  isUrlValid: boolean
  hasFormats: boolean
  selectedFormatPresetId: YtdlpFormatPresetId
  is1080pAvailable: boolean
  formBusy: boolean
  formatMode: YtdlpFormatMode
  formatCodes: YtdlpFormatCodeEntry[]
  selectedFormatCode: string
  selectedSupplementaryFormatCode: string
  hideFormatCodeUi: boolean
  onFormatChange: (id: YtdlpFormatPresetId) => void
  onFormatModeChange: (mode: YtdlpFormatMode) => void
  onFormatCodeChange: (id: string) => void
  onSupplementaryFormatCodeChange: (id: string) => void
  t: (key: string) => string
}

export function FormatSection({
  isUrlValid,
  hasFormats,
  selectedFormatPresetId,
  is1080pAvailable,
  formBusy,
  formatMode,
  formatCodes,
  selectedFormatCode,
  selectedSupplementaryFormatCode,
  hideFormatCodeUi,
  onFormatChange,
  onFormatModeChange,
  onFormatCodeChange,
  onSupplementaryFormatCodeChange,
  t,
}: FormatSectionProps) {
  if (!isUrlValid) return null

  const grouped = groupFormatsByCategory(formatCodes)
  const selectedEntry = formatCodes.find((f) => f.id === selectedFormatCode)
  const needsSupplementary =
    formatMode === "format-code" &&
    selectedEntry &&
    (selectedEntry.category === "audio-only" || selectedEntry.category === "video-only")

  const supplementaryOptions =
    selectedEntry?.category === "audio-only"
      ? grouped.videoOnly
      : selectedEntry?.category === "video-only"
        ? grouped.audioOnly
        : []

  const supplementaryLabel =
    selectedEntry?.category === "audio-only"
      ? t("downloadVideo.formatCodeSupplementaryVideo")
      : t("downloadVideo.formatCodeSupplementaryAudio")

  return (
    <div className="flex flex-col gap-3">
      {/* Only show radio group when formats have been fetched and not hidden by episodes/collection */}
      {hasFormats && !hideFormatCodeUi && (
        <>
          <Label>{t("downloadVideo.formatLabel")}</Label>
          <RadioGroup
            value={formatMode}
            onValueChange={(value: string) => onFormatModeChange(value as YtdlpFormatMode)}
            className="flex items-center gap-4"
          >
            <div className="flex items-center gap-2">
              <RadioGroupItem
                value="preset"
                id="format-mode-preset"
                data-testid="download-video-dialog-format-mode-preset"
                disabled={formBusy}
              />
              <Label htmlFor="format-mode-preset" className="cursor-pointer font-normal">
                {t("downloadVideo.formatModePreset")}
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <RadioGroupItem
                value="format-code"
                id="format-mode-code"
                data-testid="download-video-dialog-format-mode-code"
                disabled={formBusy}
              />
              <Label htmlFor="format-mode-code" className="cursor-pointer font-normal">
                {t("downloadVideo.formatModeCode")}
              </Label>
            </div>
          </RadioGroup>
        </>
      )}

      {/* Preset dropdown */}
      {(!hasFormats || formatMode === "preset") && (
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
      )}

      {/* Format code dropdown */}
      {hasFormats && formatMode === "format-code" && !hideFormatCodeUi && (
        <div className="flex flex-col gap-2">
          <Select
            value={selectedFormatCode}
            onValueChange={onFormatCodeChange}
            disabled={formBusy}
          >
            <SelectTrigger
              id="format-code"
              data-testid="download-video-dialog-format-code-select"
              className="w-full max-w-full"
            >
              <SelectValue placeholder="选择格式码..." />
            </SelectTrigger>
            <SelectContent>
              {grouped.combined.length > 0 && (
                <FormatCodeGroup label={t("downloadVideo.formatCodeGroupCombined")} entries={grouped.combined} />
              )}
              {grouped.audioOnly.length > 0 && (
                <FormatCodeGroup label={t("downloadVideo.formatCodeGroupAudioOnly")} entries={grouped.audioOnly} />
              )}
              {grouped.videoOnly.length > 0 && (
                <FormatCodeGroup label={t("downloadVideo.formatCodeGroupVideoOnly")} entries={grouped.videoOnly} />
              )}
            </SelectContent>
          </Select>

          {/* Supplementary format dropdown for audio-only or video-only selection */}
          {needsSupplementary && supplementaryOptions.length > 0 && (
            <Select
              value={selectedSupplementaryFormatCode}
              onValueChange={onSupplementaryFormatCodeChange}
              disabled={formBusy}
            >
              <SelectTrigger
                id="supplementary-format-code"
                data-testid="download-video-dialog-supplementary-format-code-select"
                className="w-full max-w-full"
              >
                <SelectValue placeholder={supplementaryLabel} />
              </SelectTrigger>
              <SelectContent>
                {supplementaryOptions.map((entry) => (
                  <SelectItem key={entry.id} value={entry.id}>
                    {entry.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      )}
    </div>
  )
}

function FormatCodeGroup({
  label,
  entries,
}: {
  label: string
  entries: YtdlpFormatCodeEntry[]
}) {
  return (
    <>
      <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">{label}</div>
      {entries.map((entry) => (
        <SelectItem key={entry.id} value={entry.id}>
          {entry.label}
        </SelectItem>
      ))}
    </>
  )
}
