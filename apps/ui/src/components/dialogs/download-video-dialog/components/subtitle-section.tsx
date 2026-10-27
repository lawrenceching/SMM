import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import type { SubtitleLanguage } from "@/api/ytdlpListSubs"

export interface SubtitleSectionProps {
  isUrlValid: boolean
  formBusy: boolean
  downloadSubtitles: boolean
  subtitleLanguages: SubtitleLanguage[]
  selectedSubtitleCodes: string[]
  isListingSubtitles: boolean
  subtitleListError: string | null
  onDownloadSubtitlesChange: (checked: boolean) => void
  onSubtitleLanguageToggle: (code: string) => void
  t: (key: string) => string
}

function languageLabel(lang: SubtitleLanguage, t: (key: string) => string): string {
  const base = lang.name && lang.name !== lang.code ? `${lang.name} (${lang.code})` : lang.code
  if (lang.kind === "auto") {
    return `${base} (${t("downloadVideo.subtitleLanguageAuto")})`
  }
  return base
}

export function SubtitleSection({
  isUrlValid,
  formBusy,
  downloadSubtitles,
  subtitleLanguages,
  selectedSubtitleCodes,
  isListingSubtitles,
  subtitleListError,
  onDownloadSubtitlesChange,
  onSubtitleLanguageToggle,
  t,
}: SubtitleSectionProps) {
  if (!isUrlValid) return null

  const selected = subtitleLanguages.filter((lang) => selectedSubtitleCodes.includes(lang.code))
  const summary = isListingSubtitles
    ? t("downloadVideo.subtitleLanguagesLoading")
    : selected.length === 0
      ? t("downloadVideo.subtitleLanguagesPlaceholder")
      : selected.map((lang) => languageLabel(lang, t)).join(", ")

  const dropdownDisabled =
    formBusy || isListingSubtitles || subtitleLanguages.length === 0

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <Checkbox
          id="download-video-subtitles"
          data-testid="download-video-dialog-subtitles-checkbox"
          checked={downloadSubtitles}
          disabled={formBusy}
          onCheckedChange={(checked) => onDownloadSubtitlesChange(checked === true)}
        />
        <Label htmlFor="download-video-subtitles" className="cursor-pointer font-normal">
          {t("downloadVideo.downloadSubtitlesLabel")}
        </Label>
      </div>

      {downloadSubtitles && (
        <div className="flex flex-col gap-2">
          <Label htmlFor="download-video-subtitle-langs">
            {t("downloadVideo.subtitleLanguagesLabel")}
          </Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                id="download-video-subtitle-langs"
                type="button"
                variant="outline"
                className="w-full justify-between font-normal"
                disabled={dropdownDisabled}
                data-testid="download-video-dialog-subtitle-langs"
              >
                <span className="truncate">{summary}</span>
              </Button>
            </PopoverTrigger>
            <PopoverContent
              className="w-(--radix-popover-trigger-width) p-2"
              align="start"
            >
              <div className="flex max-h-60 flex-col gap-1 overflow-y-auto">
                {subtitleLanguages.map((lang) => (
                  <label
                    key={lang.code}
                    className="flex items-center gap-2 rounded-sm px-2 py-1 text-sm"
                  >
                    <Checkbox
                      checked={selectedSubtitleCodes.includes(lang.code)}
                      disabled={formBusy}
                      onCheckedChange={() => onSubtitleLanguageToggle(lang.code)}
                      data-testid={`download-video-dialog-subtitle-lang-${lang.code}`}
                    />
                    <span>{languageLabel(lang, t)}</span>
                  </label>
                ))}
              </div>
            </PopoverContent>
          </Popover>
          {!isListingSubtitles && subtitleLanguages.length === 0 && !subtitleListError && (
            <p
              className="text-sm text-muted-foreground"
              data-testid="download-video-dialog-subtitle-empty"
            >
              {t("downloadVideo.subtitleLanguagesEmpty")}
            </p>
          )}
          {subtitleListError && (
            <p
              className="text-sm text-destructive"
              data-testid="download-video-dialog-subtitle-error"
            >
              {subtitleListError}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
