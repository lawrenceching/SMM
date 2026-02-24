import { useEffect, useState, useMemo } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
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
import { Video, FolderOpen } from "lucide-react"
import { basename, dirname, join } from "@/lib/path"
import type { FormatConverterDialogProps } from "./types"
import { toast } from "sonner"
import { convertVideo } from "@/api/ffmpeg"

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
  const [isConverting, setIsConverting] = useState(false)

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
  }, [isOpen, sourceDir, sourcePath, formatExt])


  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose()
      }
    }
    window.addEventListener("keydown", handleEscape)
    return () => window.removeEventListener("keydown", handleEscape)
  }, [isOpen, onClose])

  const handleCancel = () => {
    onClose()
  }

  const handleStart = async () => {
    if (!sourcePath || !outputDir.trim() || !outputFileName.trim()) {
      toast.error(t("formatConverter.invalidParams", "Please set output folder and file name."))
      return
    }
    const outputPath = join(outputDir, outputFileName)
    setIsConverting(true)
    try {
      const result = await convertVideo({
        inputPath: sourcePath,
        outputPath,
        outputFormat: outputFormat as "mp4h264" | "mp4h265" | "webm" | "mkv",
        preset: preset as "quality" | "balanced" | "speed",
      })
      if (result.error) {
        toast.error(result.error)
        return
      }
      toast.success(t("formatConverter.success", "Conversion completed."))
      onClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Conversion failed.")
    } finally {
      setIsConverting(false)
    }
  }

  const handleBrowse = () => {
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
        <DialogContent
          showCloseButton
          className="max-w-lg max-h-[80vh] flex flex-col"
          data-testid="format-converter-dialog"
        >
          <DialogHeader>
            <DialogTitle>{t("formatConverter.title")}</DialogTitle>
            <DialogDescription>{t("formatConverter.description")}</DialogDescription>
          </DialogHeader>
          <div className="py-4 text-sm text-muted-foreground">
            {t("formatConverter.noSourceHint", "Please select a file to convert first.")}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleCancel}>
              {t("cancel", { ns: "common" })}
            </Button>
            <Button onClick={handleSelectVideo} disabled={!onOpenFilePicker || !onSelectSource}>
              {t("formatConverter.selectVideo")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        showCloseButton
        className="max-w-lg max-h-[80vh] flex flex-col"
        data-testid="format-converter-dialog"
      >
        <DialogHeader className="min-w-0 shrink-0">
          <DialogTitle>{t("formatConverter.title")}</DialogTitle>
          <DialogDescription>{t("formatConverter.description")}</DialogDescription>
        </DialogHeader>

        <div className="py-4 min-w-0 min-h-0 flex-1 overflow-y-auto space-y-4">
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
            <Select value={outputFormat} onValueChange={handleFormatChange}>
              <SelectTrigger id="format-converter-format" className="w-full">
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
            <Select value={preset} onValueChange={setPreset}>
              <SelectTrigger id="format-converter-preset" className="w-full">
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
                readOnly
                value={outputDir}
                className="flex-1 min-w-0"
              />
              <Button
                type="button"
                variant="outline"
                onClick={handleBrowse}
                disabled={!onOpenFilePicker}
                aria-label={t("formatConverter.browse")}
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
              value={outputFileName}
              onChange={(e) => setOutputFileName(e.target.value)}
              className="min-w-0"
            />
          </div>
        </div>

        <DialogFooter className="shrink-0">
          <Button variant="outline" onClick={handleCancel} disabled={isConverting}>
            {t("cancel", { ns: "common" })}
          </Button>
          <Button onClick={handleStart} disabled={isConverting}>
            {t("formatConverter.start")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
