import { useEffect, useState, useMemo } from "react"
import {
  Dialog,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  ScrollableDialogBody,
  ScrollableDialogContent,
  ScrollableDialogFooter,
  ScrollableDialogHeader,
} from "@/components/ui/scrollable-dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useTranslation } from "@/lib/i18n"
import { Video, FolderOpen, Loader2 } from "lucide-react"
import { basename, dirname, join } from "@/lib/path"
import type { FormatConverterDialogProps } from "./types"
import { toast } from "sonner"
import { useJobManager } from "@/hooks/useJobManager"
import { buildFfmpegConvertJob } from "@/lib/ffmpegConvertJobFactory"

const OUTPUT_FORMATS = [
  { value: "mp4h264", ext: "mp4", labelKey: "formatConverter.formatMp4H264" },
  { value: "mp4h265", ext: "mp4", labelKey: "formatConverter.formatMp4H265" },
  { value: "webm", ext: "webm", labelKey: "formatConverter.formatWebm" },
  { value: "mkv", ext: "mkv", labelKey: "formatConverter.formatMkv" },
] as const

const PRESETS = [
  { value: "quality", labelKey: "formatConverter.presetQuality" },
  { value: "balanced", labelKey: "formatConverter.presetBalanced" },
  { value: "speed", labelKey: "formatConverter.presetSpeed" },
] as const

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, "0")}`
}

function getSourcePath(track: { filePath?: string; path?: string }): string {
  return track.filePath ?? track.path ?? ""
}

function getBaseNameWithoutExt(path: string): string {
  const name = basename(path) ?? ""
  const lastDot = name.lastIndexOf(".")
  return lastDot > 0 ? name.slice(0, lastDot) : name
}

export function FormatConverterDialog({
  isOpen,
  onClose,
  track,
  onOpenFilePicker,
  onSelectSource,
}: FormatConverterDialogProps) {
  const { t } = useTranslation(["dialogs", "common"])
  const [outputFormat, setOutputFormat] = useState<string>("mp4h264")
  const [preset, setPreset] = useState<string>("balanced")
  const [outputDir, setOutputDir] = useState("")
  const [outputFileName, setOutputFileName] = useState("")
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isConverting, setIsConverting] = useState(false)
  const { createJob } = useJobManager()

  const sourcePath = track ? getSourcePath(track) : ""
  const sourceDir = sourcePath ? dirname(sourcePath) : ""
  const sourceDisplayName = sourcePath ? basename(sourcePath) ?? sourcePath : ""

  const formatExt = useMemo(() => {
    const f = OUTPUT_FORMATS.find((x) => x.value === outputFormat)
    return f ? f.ext : "mp4"
  }, [outputFormat])

  const handleFormatChange = (value: string) => {
    setOutputFormat(value)
    const f = OUTPUT_FORMATS.find((x) => x.value === value)
    const ext = f ? f.ext : "mp4"
    setOutputFileName((prev) => {
      if (!prev.trim()) return prev
      const i = prev.lastIndexOf(".")
      if (i <= 0) return prev + "." + ext
      return prev.slice(0, i) + "." + ext
    })
  }

  useEffect(() => {
    if (!isOpen) return
    setOutputDir(sourceDir)
    const base = getBaseNameWithoutExt(sourcePath)
    setOutputFileName(base ? `${base} (1).${formatExt}` : "")
    setErrorMessage(null)
  }, [isOpen, sourceDir, sourcePath, formatExt])

  useEffect(() => {
    if (!isOpen) {
      setIsConverting(false)
      setErrorMessage(null)
    }
  }, [isOpen])

  const blockDismiss = isConverting

  const handleCancel = () => {
    if (isConverting) return
    onClose()
  }

  const handleStart = async () => {
    if (!sourcePath || !outputDir.trim() || !outputFileName.trim()) {
      toast.error(t("formatConverter.invalidParams", "Please set output folder and file name."))
      return
    }
    const outputPath = join(outputDir, outputFileName)
    setErrorMessage(null)
    setIsConverting(true)

    const job = buildFfmpegConvertJob({
      inputPath: sourcePath,
      outputPath,
      outputFormat: outputFormat as "mp4h264" | "mp4h265" | "webm" | "mkv",
      preset: preset as "quality" | "balanced" | "speed",
      title: sourceDisplayName,
    })

    try {
      await createJob(job)
      toast.success(t("formatConverter.success", "Conversion started."))
      onClose()
    } catch (err) {
      setIsConverting(false)
      setErrorMessage(t("formatConverter.errors.unknown"))
    }
  }

  const handleBrowse = () => {
    if (isConverting) return
    if (onOpenFilePicker) {
      onOpenFilePicker(
        (file) => {
          if (file.isDirectory) {
            setOutputDir(file.path)
          } else {
            setOutputDir(dirname(file.path))
          }
        },
        { selectFolder: true, initialPath: outputDir || sourceDir }
      )
    }
  }

  const handleSelectVideo = () => {
    if (onOpenFilePicker && onSelectSource) {
      onOpenFilePicker(
        (file) => {
          if (!file.isDirectory) {
            onSelectSource({
              id: 0,
              path: file.path,
              filePath: file.path,
              title: file.name,
            })
          }
        },
        { selectFolder: false }
      )
    }
  }

  if (!track && isOpen) {
    return (
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <ScrollableDialogContent
          showCloseButton
          className="max-w-lg max-h-[80vh]"
          data-testid="format-converter-dialog"
        >
          <ScrollableDialogHeader>
            <DialogTitle>{t("formatConverter.title")}</DialogTitle>
            <DialogDescription>{t("formatConverter.description")}</DialogDescription>
          </ScrollableDialogHeader>
          <ScrollableDialogBody>
          <div className="py-4 text-sm text-muted-foreground">
            {t("formatConverter.noSourceHint", "Please select a file to convert first.")}
          </div>
          </ScrollableDialogBody>
          <ScrollableDialogFooter>
            <Button variant="outline" onClick={handleCancel}>
              {t("cancel", { ns: "common" })}
            </Button>
            <Button onClick={handleSelectVideo} disabled={!onOpenFilePicker || !onSelectSource}>
              {t("formatConverter.selectVideo")}
            </Button>
          </ScrollableDialogFooter>
        </ScrollableDialogContent>
      </Dialog>
    )
  }

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open && !blockDismiss) {
          onClose()
        }
      }}
    >
      <ScrollableDialogContent
        showCloseButton={!blockDismiss}
        className="max-w-lg max-h-[80vh]"
        data-testid="format-converter-dialog"
        onInteractOutside={(e) => {
          if (blockDismiss) e.preventDefault()
        }}
        onEscapeKeyDown={(e) => {
          if (blockDismiss) e.preventDefault()
        }}
      >
        <ScrollableDialogHeader className="min-w-0">
          <DialogTitle>{t("formatConverter.title")}</DialogTitle>
          <DialogDescription>{t("formatConverter.description")}</DialogDescription>
        </ScrollableDialogHeader>

        <ScrollableDialogBody className="min-w-0 py-4">
          {errorMessage && (
            <p
              className="text-sm text-destructive mb-4"
              data-testid="format-converter-error"
            >
              {errorMessage}
            </p>
          )}

          {/* Source video */}
          <div className="flex flex-col gap-2">
            <Label>{t("formatConverter.sourceLabel")}</Label>
            <div className="flex items-center gap-3 py-2 px-3 rounded-md border bg-muted/30">
              <div className="shrink-0 w-10 h-10 rounded bg-muted flex items-center justify-center">
                <Video className="w-5 h-5 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{sourceDisplayName}</p>
                {track?.duration != null && (
                  <p className="text-xs text-muted-foreground">
                    {t("formatConverter.duration", "Duration")}: {formatDuration(track.duration)}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Output format */}
          <div className="flex flex-col gap-2">
            <Label htmlFor="format-converter-format">{t("formatConverter.outputFormatLabel")}</Label>
            <Select value={outputFormat} onValueChange={handleFormatChange} disabled={isConverting}>
              <SelectTrigger
                id="format-converter-format"
                data-testid="format-converter-format"
                className="w-full"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {OUTPUT_FORMATS.map((f) => (
                  <SelectItem key={f.value} value={f.value}>
                    {t(f.labelKey)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Preset */}
          <div className="flex flex-col gap-2">
            <Label htmlFor="format-converter-preset">{t("formatConverter.presetLabel")}</Label>
            <Select value={preset} onValueChange={setPreset} disabled={isConverting}>
              <SelectTrigger
                id="format-converter-preset"
                data-testid="format-converter-preset"
                className="w-full"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PRESETS.map((p) => (
                  <SelectItem key={p.value} value={p.value}>
                    {t(p.labelKey)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Save to */}
          <div className="flex flex-col gap-2">
            <Label htmlFor="format-converter-dir">{t("formatConverter.saveToLabel")}</Label>
            <div className="flex gap-2">
              <Input
                id="format-converter-dir"
                data-testid="format-converter-dir"
                readOnly
                disabled={isConverting}
                value={outputDir}
                className="flex-1 min-w-0"
              />
              <Button
                type="button"
                variant="outline"
                onClick={handleBrowse}
                disabled={isConverting || !onOpenFilePicker}
                aria-label={t("formatConverter.browse")}
                data-testid="format-converter-browse"
              >
                <FolderOpen className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Output file name */}
          <div className="flex flex-col gap-2">
            <Label htmlFor="format-converter-filename">{t("formatConverter.outputFileNameLabel")}</Label>
            <Input
              id="format-converter-filename"
              data-testid="format-converter-filename"
              value={outputFileName}
              onChange={(e) => setOutputFileName(e.target.value)}
              disabled={isConverting}
              className="min-w-0"
            />
          </div>
        </ScrollableDialogBody>

        <ScrollableDialogFooter>
          <Button
            variant="outline"
            onClick={handleCancel}
            disabled={isConverting}
            data-testid="format-converter-cancel"
          >
            {t("cancel", { ns: "common" })}
          </Button>
          <Button
            className={isConverting ? "inline-flex items-center gap-2" : undefined}
            onClick={() => void handleStart()}
            disabled={isConverting}
            data-testid="format-converter-start"
          >
            {isConverting ? (
              <>
                <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
                {t("formatConverter.start")}
              </>
            ) : (
              t("formatConverter.start")
            )}
          </Button>
        </ScrollableDialogFooter>
      </ScrollableDialogContent>
    </Dialog>
  )
}
