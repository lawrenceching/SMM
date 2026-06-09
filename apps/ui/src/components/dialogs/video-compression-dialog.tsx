import { useEffect, useMemo, useState } from "react"
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
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useTranslation } from "@/lib/i18n"
import { Video, FolderOpen, Loader2, Film, Zap, Scale, Sparkles, Music, AlertTriangle } from "lucide-react"
import { basename, dirname, join } from "@/lib/path"
import { toast } from "sonner"
import { useCreateFfmpegCompressJobMutation } from "@/hooks/ffmpeg/useCreateFfmpegCompressJobMutation"
import { useFfmpegEncodersQuery } from "@/hooks/ffmpeg/useFfmpegEncodersQuery"
import { getMediaTags } from "@/api/ffmpeg"
import {
  FFMPEG_COMPRESS_ENCODER_CATALOG,
  getFfmpegCompressPreset,
  type FfmpegCompressContainer,
  type FfmpegCompressEncoderPreset,
  type FfmpegCompressHdr,
  type FfmpegCompressOptions,
  type FfmpegCompressPresetKey,
  type FfmpegCompressQualityMode,
  type FfmpegCompressResolutionMode,
  type FfmpegCompressAudioMode,
  type FfmpegCompressAudioCodec,
  type FfmpegCompressProfile,
  type FfmpegCompressPixFmt,
  type FfmpegCompressDenoise,
  type FfmpegCompressMetadata,
  type FfmpegEncoderInfo,
} from "@core/whitelistedCmd/constants"
import { computeTargetBitrateKbpsFromSize } from "@core/whitelistedCmd/constants"
import { estimateCompressSizeMb } from "@core/whitelistedCmd/compressEstimation"
import type { VideoCompressionDialogProps } from "./types"

const CONTAINERS: FfmpegCompressContainer[] = ["mp4", "mkv", "webm", "mov"]

const CONTAINER_LABEL_KEYS = {
  mp4: "videoCompression.containerMp4",
  mkv: "videoCompression.containerMkv",
  webm: "videoCompression.containerWebm",
  mov: "videoCompression.containerMov",
} as const satisfies Record<FfmpegCompressContainer, `videoCompression.container${string}`>

const PIX_FMT_LABEL_KEYS = {
  yuv420p: "videoCompression.pixFmtYuv420p",
  yuv444p: "videoCompression.pixFmtYuv444p",
  yuv420p10le: "videoCompression.pixFmtYuv420p10le",
} as const

const PRESET_CARDS = [
  { key: "speed", icon: <Zap className="h-5 w-5" />, nameKey: "videoCompression.presetCardSpeedName", descKey: "videoCompression.presetCardSpeedDesc" },
  { key: "balanced", icon: <Scale className="h-5 w-5" />, nameKey: "videoCompression.presetCardBalancedName", descKey: "videoCompression.presetCardBalancedDesc" },
  { key: "quality", icon: <Sparkles className="h-5 w-5" />, nameKey: "videoCompression.presetCardQualityName", descKey: "videoCompression.presetCardQualityDesc" },
  { key: "extreme", icon: <Film className="h-5 w-5" />, nameKey: "videoCompression.presetCardExtremeName", descKey: "videoCompression.presetCardExtremeDesc" },
  { key: "audioOnly", icon: <Music className="h-5 w-5" />, nameKey: "videoCompression.presetCardAudioOnlyName", descKey: "videoCompression.presetCardAudioOnlyDesc" },
] as const satisfies ReadonlyArray<{
  key: Exclude<FfmpegCompressPresetKey, "custom">
  icon: React.ReactNode
  nameKey: `videoCompression.presetCard${string}`
  descKey: `videoCompression.presetCard${string}`
}>

function getBaseNameWithoutExt(path: string): string {
  const name = basename(path) ?? ""
  const lastDot = name.lastIndexOf(".")
  return lastDot > 0 ? name.slice(0, lastDot) : name
}

function parsePositiveInt(value: string, fallback: number): number {
  const n = Number.parseInt(value, 10)
  return Number.isFinite(n) && n >= 0 ? n : fallback
}

function cloneDefaultOptions(): FfmpegCompressOptions {
  // Use the balanced preset as the default starting point.
  const balanced = getFfmpegCompressPreset("balanced")
  if (!balanced) {
    return {
      presetKey: "balanced",
      container: "mp4",
      videoEncoder: "libx264",
      qualityMode: "crf",
      crf: 23,
      encoderPreset: "medium",
      resolutionMode: "original",
      frameRateMode: "original",
      audioMode: "keep",
      twoPass: false,
      hdr: "preserve",
      filters: { denoise: "none", sharpen: false },
      metadata: "preserve",
    }
  }
  return { ...balanced.options, filters: { ...balanced.options.filters } }
}

function applyPreset(key: Exclude<FfmpegCompressPresetKey, "custom">): FfmpegCompressOptions {
  const preset = getFfmpegCompressPreset(key)
  if (!preset) return cloneDefaultOptions()
  return { ...preset.options, filters: { ...preset.options.filters } }
}

export function VideoCompressionDialog({
  isOpen,
  onClose,
  filePath,
  title,
  duration,
  onOpenFilePicker,
  onSelectSource,
}: VideoCompressionDialogProps) {
  const { t } = useTranslation(["dialogs", "common"])
  const [tab, setTab] = useState<"presets" | "custom">("presets")
  const [options, setOptions] = useState<FfmpegCompressOptions>(cloneDefaultOptions)
  const [outputDir, setOutputDir] = useState("")
  const [outputFileName, setOutputFileName] = useState("")
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const {
    mutateAsync: createCompressJobAsync,
    reset: resetCompressJobMutation,
    isPending: isCompressing,
  } = useCreateFfmpegCompressJobMutation()
  const [probedDuration, setProbedDuration] = useState<number | undefined>(duration)
  const [probedVideoBitrateKbps, setProbedVideoBitrateKbps] = useState<number | undefined>(undefined)
  const [probedAudioBitrateKbps, setProbedAudioBitrateKbps] = useState<number | undefined>(undefined)
  const [probedTotalBitrateKbps, setProbedTotalBitrateKbps] = useState<number | undefined>(undefined)
  const encodersQuery = useFfmpegEncodersQuery()

  const encodersAvailable = encodersQuery.data?.usable ?? []
  const encodersError = encodersQuery.error
  const encodersLoading = encodersQuery.isPending

  const sourceDisplayName = useMemo(() => {
    if (title) return title
    if (filePath) return basename(filePath) ?? filePath
    return ""
  }, [filePath, title])

  // Update state when filePath changes (e.g. user picks a different file).
  useEffect(() => {
    if (!filePath) {
      setOutputDir("")
      setOutputFileName("")
      return
    }
    const dir = dirname(filePath)
    const ext = options.container
    const base = getBaseNameWithoutExt(filePath)
    setOutputDir(dir)
    setOutputFileName(base ? `${base} (1).${ext}` : "")
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filePath])

  // Probe duration when filePath changes (used for target size hint)
  useEffect(() => {
    if (!filePath) {
      setProbedDuration(duration)
      setProbedVideoBitrateKbps(undefined)
      setProbedAudioBitrateKbps(undefined)
      setProbedTotalBitrateKbps(undefined)
      return
    }
    if (duration && duration > 0) {
      setProbedDuration(duration)
    }
    let cancelled = false
    void (async () => {
      try {
        const res = await getMediaTags({ path: filePath })
        if (cancelled) return
        if (res.duration && Number.isFinite(res.duration)) {
          setProbedDuration(res.duration)
        }
        if (res.videoBitrateKbps && Number.isFinite(res.videoBitrateKbps)) {
          setProbedVideoBitrateKbps(res.videoBitrateKbps)
        } else {
          setProbedVideoBitrateKbps(undefined)
        }
        if (res.audioBitrateKbps && Number.isFinite(res.audioBitrateKbps)) {
          setProbedAudioBitrateKbps(res.audioBitrateKbps)
        } else {
          setProbedAudioBitrateKbps(undefined)
        }
        if (res.bitrateKbps && Number.isFinite(res.bitrateKbps)) {
          setProbedTotalBitrateKbps(res.bitrateKbps)
        } else {
          setProbedTotalBitrateKbps(undefined)
        }
      } catch {
        // ignore
      }
    })()
    return () => {
      cancelled = true
    }
  }, [filePath, duration])

  // Filtered encoders based on selected container.
  const compatibleEncoders = useMemo<FfmpegEncoderInfo[]>(() => {
    if (encodersAvailable.length === 0) return []
    return encodersAvailable.filter((e) =>
      e.compatibleContainers.includes(options.container),
    )
  }, [encodersAvailable, options.container])

  // The encoder dropdown should also include the static catalog entries
  // (in case detection failed) — use encoder query results when available,
  // fall back to the full static catalog filtered by container.
  const allCompatibleEncoders = useMemo<FfmpegEncoderInfo[]>(() => {
    const list = compatibleEncoders.length > 0
      ? compatibleEncoders
      : FFMPEG_COMPRESS_ENCODER_CATALOG.filter((e) =>
          e.compatibleContainers.includes(options.container),
        )
    return list
  }, [compatibleEncoders, options.container])

  // If current encoder is not compatible with current container, switch to the
  // first compatible one.
  useEffect(() => {
    const isCurrentCompatible = allCompatibleEncoders.some(
      (e) => e.id === options.videoEncoder,
    )
    if (!isCurrentCompatible && allCompatibleEncoders.length > 0) {
      const first = allCompatibleEncoders[0]!
      setOptions((prev) => ({
        ...prev,
        videoEncoder: first.id,
        encoderPreset: first.defaultPreset,
        crf: first.crfRange.default,
      }))
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allCompatibleEncoders])

  // Auto-enable 2-pass for target size mode.
  useEffect(() => {
    if (options.qualityMode === "targetSize" && !options.twoPass) {
      setOptions((prev) => ({ ...prev, twoPass: true }))
    }
  }, [options.qualityMode, options.twoPass])

  useEffect(() => {
    if (!isOpen) {
      resetCompressJobMutation()
      setErrorMessage(null)
    }
  }, [isOpen, resetCompressJobMutation])

  const blockDismiss = isCompressing

  const handleCancel = () => {
    if (isCompressing) return
    onClose()
  }

  const handleStart = async () => {
    if (!filePath || !outputDir.trim() || !outputFileName.trim()) {
      toast.error(t("videoCompression.invalidParams", "Please set output folder and file name."))
      return
    }
    const outputPath = join(outputDir, outputFileName)
    setErrorMessage(null)

    try {
      await createCompressJobAsync({
        inputPath: filePath,
        outputPath,
        outputContainer: options.container,
        compressOptions: options,
        title: sourceDisplayName,
      })
      toast.success(t("videoCompression.success", "Compression started."))
      onClose()
    } catch {
      setErrorMessage(t("formatConverter.errors.unknown"))
    }
  }

  const handleBrowse = () => {
    if (isCompressing) return
    onOpenFilePicker?.(
      (file) => {
        if (file.isDirectory) {
          setOutputDir(file.path)
        } else {
          setOutputDir(dirname(file.path))
        }
      },
      { selectFolder: true, initialPath: outputDir || (filePath ? dirname(filePath) : undefined) },
    )
  }

  const handleSelectVideo = () => {
    onOpenFilePicker?.(
      (file) => {
        if (!file.isDirectory) {
          onSelectSource?.(file.path, file.name)
        }
      },
      { selectFolder: false },
    )
  }

  const updateField = <K extends keyof FfmpegCompressOptions>(
    key: K,
    value: FfmpegCompressOptions[K],
  ) => {
    setOptions((prev) => ({ ...prev, [key]: value, presetKey: "custom" }))
  }

  const handlePresetSelect = (key: Exclude<FfmpegCompressPresetKey, "custom">) => {
    setOptions(applyPreset(key))
  }

  // Derived bitrate hint for target size mode
  const targetSizeBitrateHint = useMemo(() => {
    if (options.qualityMode !== "targetSize" || !options.targetSizeMB) return null
    if (!probedDuration || probedDuration <= 0) return null
    const audioKbps = options.audioBitrateKbps ?? 0
    return computeTargetBitrateKbpsFromSize(options.targetSizeMB, probedDuration, audioKbps)
  }, [options.qualityMode, options.targetSizeMB, options.audioBitrateKbps, probedDuration])

  // Estimated output size (Approach D — see design §9).
  // Returns null until the source probe has completed.
  const sizeEstimate = useMemo(() => {
    if (!probedDuration || probedDuration <= 0) return null
    return estimateCompressSizeMb(options, {
      durationSec: probedDuration,
      width: 0, // unknown until second probe; estimator uses resolutionMode instead
      height: 0,
      videoBitrateKbps: probedVideoBitrateKbps,
      audioBitrateKbps: probedAudioBitrateKbps,
      totalBitrateKbps: probedTotalBitrateKbps,
      fps: 30, // best-effort default; estimator treats 30 as the typical frame rate
    })
  }, [
    options,
    probedDuration,
    probedVideoBitrateKbps,
    probedAudioBitrateKbps,
    probedTotalBitrateKbps,
  ])

  // The current encoder's metadata
  const currentEncoder = useMemo(
    () => FFMPEG_COMPRESS_ENCODER_CATALOG.find((e) => e.id === options.videoEncoder),
    [options.videoEncoder],
  )

  // If the user's current options.encoderPreset isn't in the encoder's
  // presetOptions, fall back to the encoder's default.
  useEffect(() => {
    if (!currentEncoder) return
    if (currentEncoder.presetOptions.includes(options.encoderPreset as FfmpegCompressEncoderPreset)) return
    setOptions((prev) => ({ ...prev, encoderPreset: currentEncoder.defaultPreset }))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentEncoder])

  if (!filePath) {
    return (
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <ScrollableDialogContent
          showCloseButton
          className="max-w-lg max-h-[80vh]"
          data-testid="video-compression-dialog"
        >
          <ScrollableDialogHeader>
            <DialogTitle>{t("videoCompression.title")}</DialogTitle>
            <DialogDescription>{t("videoCompression.description")}</DialogDescription>
          </ScrollableDialogHeader>
          <ScrollableDialogBody>
            <div className="py-4 text-sm text-muted-foreground">
              {t("videoCompression.selectVideoHint")}
            </div>
          </ScrollableDialogBody>
          <ScrollableDialogFooter>
            <Button variant="outline" onClick={handleCancel}>
              {t("cancel", { ns: "common" })}
            </Button>
            <Button
              onClick={handleSelectVideo}
              disabled={!onOpenFilePicker || !onSelectSource}
            >
              {t("videoCompression.selectVideo")}
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
        className="max-w-2xl max-h-[85vh]"
        data-testid="video-compression-dialog"
        onInteractOutside={(e) => {
          if (blockDismiss) e.preventDefault()
        }}
        onEscapeKeyDown={(e) => {
          if (blockDismiss) e.preventDefault()
        }}
      >
        <ScrollableDialogHeader className="min-w-0">
          <DialogTitle>{t("videoCompression.title")}</DialogTitle>
          <DialogDescription>{t("videoCompression.description")}</DialogDescription>
        </ScrollableDialogHeader>

        <ScrollableDialogBody className="min-w-0 py-2 space-y-4">
          {errorMessage && (
            <p className="text-sm text-destructive" data-testid="video-compression-error">
              {errorMessage}
            </p>
          )}

          {/* Source video card */}
          <div className="flex flex-col gap-2">
            <Label>{t("videoCompression.sourceLabel")}</Label>
            <div className="flex items-center gap-3 py-2 px-3 rounded-md border bg-muted/30">
              <div className="shrink-0 w-10 h-10 rounded bg-muted flex items-center justify-center">
                <Video className="w-5 h-5 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{sourceDisplayName}</p>
                {probedDuration != null && probedDuration > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {t("videoCompression.duration", "Duration")}: {formatDuration(probedDuration)}
                  </p>
                )}
                {sizeEstimate && (
                  <p
                    className="text-xs text-muted-foreground"
                    data-testid="video-compression-size-estimate"
                  >
                    {t("videoCompression.estimatedOutputLabel", "Estimated output")}:{" "}
                    <span className="font-medium text-foreground">
                      {t("videoCompression.sizeMb", { mb: formatSizeMB(sizeEstimate.estimatedSizeMB) })}
                    </span>
                    {sizeEstimate.pctOfSource != null && (
                      <span className="text-muted-foreground">
                        {" "}
                        (
                        {sizeEstimate.pctOfSource < 1
                          ? t("videoCompression.pctSmaller", { pct: Math.round((1 - sizeEstimate.pctOfSource) * 100) })
                          : t("videoCompression.pctLarger", { pct: Math.round((sizeEstimate.pctOfSource - 1) * 100) })}
                        )
                      </span>
                    )}
                  </p>
                )}
                {sizeEstimate && (
                  <p className="text-[10px] text-muted-foreground/70 mt-0.5">
                    {t("videoCompression.estimateCaveat", "Estimate based on encoder heuristic; actual size depends on content complexity.")}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Encoder availability notice */}
          {encodersError && !encodersLoading && encodersAvailable.length === 0 && (
            <div className="flex items-start gap-2 text-xs text-amber-600 dark:text-amber-400 rounded-md border border-amber-300/40 bg-amber-50/40 dark:bg-amber-900/10 p-2">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>{t("videoCompression.noEncodersDetected")}</span>
            </div>
          )}

          <Tabs value={tab} onValueChange={(v) => setTab(v as "presets" | "custom")}>
            <TabsList>
              <TabsTrigger value="presets" data-testid="video-compression-tab-presets">
                {t("videoCompression.presetsTab")}
              </TabsTrigger>
              <TabsTrigger value="custom" data-testid="video-compression-tab-custom">
                {t("videoCompression.customTab")}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="presets" className="space-y-3 mt-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3" data-testid="video-compression-presets">
                {PRESET_CARDS.map((card) => {
                  const isSelected = options.presetKey === card.key
                  return (
                    <button
                      key={card.key}
                      type="button"
                      onClick={() => handlePresetSelect(card.key)}
                      className={
                        "text-left p-3 rounded-md border transition-colors " +
                        (isSelected
                          ? "border-primary bg-primary/5 ring-1 ring-primary"
                          : "hover:bg-muted/40")
                      }
                      data-testid={`video-compression-preset-${card.key}`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-primary">{card.icon}</span>
                        <span className="font-medium text-sm">
                          {t(card.nameKey)}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {t(card.descKey)}
                      </p>
                    </button>
                  )
                })}
              </div>
            </TabsContent>

            <TabsContent value="custom" className="space-y-4 mt-3">
              {/* Output container + Encoder */}
              <div className="rounded-md border p-3 space-y-3">
                <p className="text-sm font-medium">{t("videoCompression.videoSection")}</p>

                <div className="flex flex-col gap-2">
                  <Label htmlFor="vc-container">{t("videoCompression.outputContainerLabel")}</Label>
                  <Select
                    value={options.container}
                    onValueChange={(v) => updateField("container", v as FfmpegCompressContainer)}
                    disabled={isCompressing}
                  >
                    <SelectTrigger id="vc-container" data-testid="video-compression-container">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CONTAINERS.map((c) => (
                        <SelectItem key={c} value={c}>
                          {t(CONTAINER_LABEL_KEYS[c])}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex flex-col gap-2">
                  <Label htmlFor="vc-encoder">{t("videoCompression.encoderLabel")}</Label>
                  {allCompatibleEncoders.length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      {t("videoCompression.noCompatibleEncoder")}
                    </p>
                  ) : (
                    <Select
                      value={options.videoEncoder}
                      onValueChange={(v) => {
                        const enc = FFMPEG_COMPRESS_ENCODER_CATALOG.find((e) => e.id === v)
                        setOptions((prev) => ({
                          ...prev,
                          videoEncoder: v,
                          encoderPreset: enc?.defaultPreset ?? prev.encoderPreset,
                          crf: enc?.crfRange.default ?? prev.crf,
                          presetKey: "custom",
                        }))
                      }}
                      disabled={isCompressing}
                    >
                      <SelectTrigger id="vc-encoder" data-testid="video-compression-encoder">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {allCompatibleEncoders.map((e) => (
                          <SelectItem key={e.id} value={e.id}>
                            {e.id}
                            {e.hwAccel ? ` (${e.hwAccel})` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>

                <div className="flex flex-col gap-2">
                  <Label htmlFor="vc-preset">{t("videoCompression.encoderPresetLabel")}</Label>
                  <Select
                    value={options.encoderPreset ?? "medium"}
                    onValueChange={(v) => updateField("encoderPreset", v)}
                    disabled={isCompressing}
                  >
                    <SelectTrigger id="vc-preset" data-testid="video-compression-encoder-preset">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(currentEncoder?.presetOptions ?? ["medium"]).map((p) => (
                        <SelectItem key={p} value={p}>
                          {p}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Quality mode */}
                <div className="flex flex-col gap-2">
                  <Label htmlFor="vc-quality-mode">{t("videoCompression.qualityModeLabel")}</Label>
                  <Select
                    value={options.qualityMode ?? "crf"}
                    onValueChange={(v) => updateField("qualityMode", v as FfmpegCompressQualityMode)}
                    disabled={isCompressing}
                  >
                    <SelectTrigger id="vc-quality-mode" data-testid="video-compression-quality-mode">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="crf">{t("videoCompression.qualityModeCrf")}</SelectItem>
                      <SelectItem value="targetBitrate">{t("videoCompression.qualityModeTargetBitrate")}</SelectItem>
                      <SelectItem value="targetSize">{t("videoCompression.qualityModeTargetSize")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {options.qualityMode === "crf" && (
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="vc-crf">{t("videoCompression.crfLabel")}</Label>
                    <Input
                      id="vc-crf"
                      data-testid="video-compression-crf"
                      type="number"
                      min={0}
                      max={currentEncoder?.crfRange.max ?? 51}
                      value={options.crf ?? 23}
                      onChange={(e) => {
                        const v = parsePositiveInt(e.target.value, options.crf ?? 23)
                        const max = currentEncoder?.crfRange.max ?? 51
                        updateField("crf", Math.min(max, v))
                      }}
                      disabled={isCompressing}
                    />
                  </div>
                )}

                {options.qualityMode === "targetBitrate" && (
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="vc-target-bitrate">{t("videoCompression.targetBitrateLabel")}</Label>
                    <Input
                      id="vc-target-bitrate"
                      data-testid="video-compression-target-bitrate"
                      type="number"
                      min={100}
                      value={options.targetBitrateKbps ?? 2000}
                      onChange={(e) =>
                        updateField("targetBitrateKbps", parsePositiveInt(e.target.value, 2000))
                      }
                      disabled={isCompressing}
                    />
                  </div>
                )}

                {options.qualityMode === "targetSize" && (
                  <>
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="vc-target-size">{t("videoCompression.targetSizeLabel")}</Label>
                      <Input
                        id="vc-target-size"
                        data-testid="video-compression-target-size"
                        type="number"
                        min={1}
                        value={options.targetSizeMB ?? 100}
                        onChange={(e) =>
                          updateField("targetSizeMB", parsePositiveInt(e.target.value, 100))
                        }
                        disabled={isCompressing}
                      />
                    </div>
                    {targetSizeBitrateHint != null && (
                      <p className="text-xs text-muted-foreground" data-testid="video-compression-target-bitrate-hint">
                        {t("videoCompression.targetBitrateHint", { kbps: targetSizeBitrateHint })}
                      </p>
                    )}
                  </>
                )}

                {/* Profile (only meaningful for x264/x265) */}
                {currentEncoder && (currentEncoder.id === "libx264" || currentEncoder.id === "libx265") && (
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="vc-profile">{t("videoCompression.profileLabel")}</Label>
                    <Select
                      value={options.profile ?? "high"}
                      onValueChange={(v) => updateField("profile", v as FfmpegCompressProfile)}
                      disabled={isCompressing}
                    >
                      <SelectTrigger id="vc-profile" data-testid="video-compression-profile">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="baseline">{t("videoCompression.profileBaseline")}</SelectItem>
                        <SelectItem value="main">{t("videoCompression.profileMain")}</SelectItem>
                        <SelectItem value="high">{t("videoCompression.profileHigh")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Pixel format */}
                <div className="flex flex-col gap-2">
                  <Label htmlFor="vc-pixfmt">{t("videoCompression.pixFmtLabel")}</Label>
                  <Select
                    value={options.pixFmt ?? "yuv420p"}
                    onValueChange={(v) => updateField("pixFmt", v as FfmpegCompressPixFmt)}
                    disabled={isCompressing}
                  >
                    <SelectTrigger id="vc-pixfmt" data-testid="video-compression-pixfmt">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(currentEncoder?.supportedPixFmts ?? ["yuv420p"]).map((p) => {
                        const labelKey = PIX_FMT_LABEL_KEYS[p as keyof typeof PIX_FMT_LABEL_KEYS]
                        return (
                          <SelectItem key={p} value={p}>
                            {labelKey ? t(labelKey) : p}
                          </SelectItem>
                        )
                      })}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex flex-col gap-2">
                  <Label htmlFor="vc-gop">{t("videoCompression.gopSizeLabel")}</Label>
                  <Input
                    id="vc-gop"
                    data-testid="video-compression-gop"
                    type="number"
                    min={0}
                    value={options.gopSize ?? 0}
                    onChange={(e) =>
                      updateField("gopSize", parsePositiveInt(e.target.value, 0))
                    }
                    disabled={isCompressing}
                  />
                </div>
              </div>

              {/* Resolution & frame rate */}
              <div className="rounded-md border p-3 space-y-3">
                <p className="text-sm font-medium">{t("videoCompression.resolutionSection")}</p>

                <div className="flex flex-col gap-2">
                  <Label htmlFor="vc-resolution">{t("videoCompression.resolutionLabel")}</Label>
                  <Select
                    value={options.resolutionMode}
                    onValueChange={(v) => updateField("resolutionMode", v as FfmpegCompressResolutionMode)}
                    disabled={isCompressing}
                  >
                    <SelectTrigger id="vc-resolution" data-testid="video-compression-resolution">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="original">{t("videoCompression.resolutionOriginal")}</SelectItem>
                      <SelectItem value="480p">{t("videoCompression.resolution480p")}</SelectItem>
                      <SelectItem value="720p">{t("videoCompression.resolution720p")}</SelectItem>
                      <SelectItem value="1080p">{t("videoCompression.resolution1080p")}</SelectItem>
                      <SelectItem value="4k">{t("videoCompression.resolution4k")}</SelectItem>
                      <SelectItem value="custom">{t("videoCompression.resolutionCustom")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {options.resolutionMode === "custom" && (
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="vc-custom-width">{t("videoCompression.customWidthLabel")}</Label>
                    <Input
                      id="vc-custom-width"
                      data-testid="video-compression-custom-width"
                      type="number"
                      min={2}
                      value={options.customWidth ?? 1280}
                      onChange={(e) =>
                        updateField("customWidth", parsePositiveInt(e.target.value, 1280))
                      }
                      disabled={isCompressing}
                    />
                  </div>
                )}

                <div className="flex flex-col gap-2">
                  <Label htmlFor="vc-framerate">{t("videoCompression.frameRateLabel")}</Label>
                  <Select
                    value={String(options.frameRateMode)}
                    onValueChange={(v) => {
                      if (v === "original" || v === "custom") {
                        updateField("frameRateMode", v)
                      } else {
                        updateField("frameRateMode", Number(v) as 24 | 30 | 60)
                      }
                    }}
                    disabled={isCompressing}
                  >
                    <SelectTrigger id="vc-framerate" data-testid="video-compression-framerate">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="original">{t("videoCompression.frameRateOriginal")}</SelectItem>
                      <SelectItem value="24">{t("videoCompression.frameRate24")}</SelectItem>
                      <SelectItem value="30">{t("videoCompression.frameRate30")}</SelectItem>
                      <SelectItem value="60">{t("videoCompression.frameRate60")}</SelectItem>
                      <SelectItem value="custom">{t("videoCompression.frameRateCustom")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {options.frameRateMode === "custom" && (
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="vc-custom-fps">{t("videoCompression.customFpsLabel")}</Label>
                    <Input
                      id="vc-custom-fps"
                      data-testid="video-compression-custom-fps"
                      type="number"
                      min={1}
                      max={120}
                      value={options.customFps ?? 30}
                      onChange={(e) =>
                        updateField("customFps", parsePositiveInt(e.target.value, 30))
                      }
                      disabled={isCompressing}
                    />
                  </div>
                )}

                <div className="flex flex-col gap-2">
                  <Label htmlFor="vc-frame-skip">{t("videoCompression.frameSkipLabel")}</Label>
                  <Input
                    id="vc-frame-skip"
                    data-testid="video-compression-frame-skip"
                    type="number"
                    min={0}
                    value={options.frameSkip ?? 0}
                    onChange={(e) =>
                      updateField("frameSkip", parsePositiveInt(e.target.value, 0))
                    }
                    disabled={isCompressing}
                  />
                </div>
              </div>

              {/* Audio */}
              <div className="rounded-md border p-3 space-y-3">
                <p className="text-sm font-medium">{t("videoCompression.audioSection")}</p>

                <div className="flex flex-col gap-2">
                  <Label>{t("videoCompression.audioModeKeep").split(" ")[0]}</Label>
                  <Select
                    value={options.audioMode}
                    onValueChange={(v) => updateField("audioMode", v as FfmpegCompressAudioMode)}
                    disabled={isCompressing}
                  >
                    <SelectTrigger data-testid="video-compression-audio-mode">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="keep">{t("videoCompression.audioModeKeep")}</SelectItem>
                      <SelectItem value="reencode">{t("videoCompression.audioModeReencode")}</SelectItem>
                      <SelectItem value="remove">{t("videoCompression.audioModeRemove")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {options.audioMode === "reencode" && (
                  <>
                    <div className="flex flex-col gap-2">
                      <Label>{t("videoCompression.audioCodecLabel")}</Label>
                      <Select
                        value={options.audioCodec ?? "aac"}
                        onValueChange={(v) => updateField("audioCodec", v as FfmpegCompressAudioCodec)}
                        disabled={isCompressing}
                      >
                        <SelectTrigger data-testid="video-compression-audio-codec">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="aac">aac</SelectItem>
                          <SelectItem value="libopus">libopus</SelectItem>
                          <SelectItem value="libmp3lame">libmp3lame</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="vc-audio-bitrate">{t("videoCompression.audioBitrateLabel")}</Label>
                      <Input
                        id="vc-audio-bitrate"
                        data-testid="video-compression-audio-bitrate"
                        type="number"
                        min={32}
                        value={options.audioBitrateKbps ?? 128}
                        onChange={(e) =>
                          updateField("audioBitrateKbps", parsePositiveInt(e.target.value, 128))
                        }
                        disabled={isCompressing}
                      />
                    </div>
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="vc-audio-sample-rate">{t("videoCompression.audioSampleRateLabel")}</Label>
                      <Select
                        value={String(options.audioSampleRateHz ?? 48000)}
                        onValueChange={(v) => updateField("audioSampleRateHz", Number(v))}
                        disabled={isCompressing}
                      >
                        <SelectTrigger id="vc-audio-sample-rate" data-testid="video-compression-audio-sample-rate">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="44100">44100</SelectItem>
                          <SelectItem value="48000">48000</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex flex-col gap-2">
                      <Label>{t("videoCompression.audioChannelsLabel")}</Label>
                      <Select
                        value={String(options.audioChannels ?? 2)}
                        onValueChange={(v) => updateField("audioChannels", Number(v) as 1 | 2)}
                        disabled={isCompressing}
                      >
                        <SelectTrigger data-testid="video-compression-audio-channels">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1">{t("videoCompression.audioChannels1")}</SelectItem>
                          <SelectItem value="2">{t("videoCompression.audioChannels2")}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </>
                )}
              </div>

              {/* Advanced */}
              <div className="rounded-md border p-3 space-y-3">
                <p className="text-sm font-medium">{t("videoCompression.advancedSection")}</p>

                <div className="flex items-center gap-2">
                  <Checkbox
                    id="vc-two-pass"
                    data-testid="video-compression-two-pass"
                    checked={options.twoPass}
                    onCheckedChange={(checked) => updateField("twoPass", checked === true)}
                    disabled={isCompressing}
                  />
                  <Label htmlFor="vc-two-pass" className="font-normal">
                    {t("videoCompression.twoPassLabel")}
                  </Label>
                </div>
                {options.qualityMode === "targetSize" && (
                  <p className="text-xs text-muted-foreground">{t("videoCompression.twoPassHint")}</p>
                )}

                <div className="flex flex-col gap-2">
                  <Label htmlFor="vc-threads">{t("videoCompression.threadsLabel")}</Label>
                  <Input
                    id="vc-threads"
                    data-testid="video-compression-threads"
                    type="number"
                    min={0}
                    value={options.threads ?? 0}
                    onChange={(e) =>
                      updateField("threads", parsePositiveInt(e.target.value, 0))
                    }
                    disabled={isCompressing}
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <Label>{t("videoCompression.hdrLabel")}</Label>
                  <Select
                    value={options.hdr}
                    onValueChange={(v) => updateField("hdr", v as FfmpegCompressHdr)}
                    disabled={isCompressing}
                  >
                    <SelectTrigger data-testid="video-compression-hdr">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="preserve">{t("videoCompression.hdrPreserve")}</SelectItem>
                      <SelectItem value="convertToSdr">{t("videoCompression.hdrConvertToSdr")}</SelectItem>
                    </SelectContent>
                  </Select>
                  {options.hdr === "convertToSdr" && (
                    <p className="text-xs text-amber-600 dark:text-amber-400">
                      {t("videoCompression.hdrConvertToSdrWarning")}
                    </p>
                  )}
                </div>

                <div className="flex flex-col gap-2">
                  <Label>{t("videoCompression.denoiseLabel")}</Label>
                  <Select
                    value={options.filters.denoise}
                    onValueChange={(v) =>
                      setOptions((prev) => ({
                        ...prev,
                        filters: { ...prev.filters, denoise: v as FfmpegCompressDenoise },
                        presetKey: "custom",
                      }))
                    }
                    disabled={isCompressing}
                  >
                    <SelectTrigger data-testid="video-compression-denoise">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">{t("videoCompression.denoiseNone")}</SelectItem>
                      <SelectItem value="light">{t("videoCompression.denoiseLight")}</SelectItem>
                      <SelectItem value="medium">{t("videoCompression.denoiseMedium")}</SelectItem>
                      <SelectItem value="strong">{t("videoCompression.denoiseStrong")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center gap-2">
                  <Checkbox
                    id="vc-sharpen"
                    data-testid="video-compression-sharpen"
                    checked={options.filters.sharpen}
                    onCheckedChange={(checked) =>
                      setOptions((prev) => ({
                        ...prev,
                        filters: { ...prev.filters, sharpen: checked === true },
                        presetKey: "custom",
                      }))
                    }
                    disabled={isCompressing}
                  />
                  <Label htmlFor="vc-sharpen" className="font-normal">
                    {t("videoCompression.sharpenLabel")}
                  </Label>
                </div>

                <div className="flex flex-col gap-2">
                  <Label>{t("videoCompression.metadataLabel")}</Label>
                  <Select
                    value={options.metadata}
                    onValueChange={(v) => updateField("metadata", v as FfmpegCompressMetadata)}
                    disabled={isCompressing}
                  >
                    <SelectTrigger data-testid="video-compression-metadata">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="preserve">{t("videoCompression.metadataPreserve")}</SelectItem>
                      <SelectItem value="strip">{t("videoCompression.metadataStrip")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </TabsContent>
          </Tabs>

          {/* Output section */}
          <div className="flex flex-col gap-2">
            <Label htmlFor="vc-output-dir">{t("videoCompression.saveToLabel")}</Label>
            <div className="flex gap-2">
              <Input
                id="vc-output-dir"
                data-testid="video-compression-output-dir"
                readOnly
                disabled={isCompressing}
                value={outputDir}
                className="flex-1 min-w-0"
              />
              <Button
                type="button"
                variant="outline"
                onClick={handleBrowse}
                disabled={isCompressing || !onOpenFilePicker}
                aria-label={t("videoCompression.browse")}
                data-testid="video-compression-browse"
              >
                <FolderOpen className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="vc-output-filename">{t("videoCompression.outputFileNameLabel")}</Label>
            <Input
              id="vc-output-filename"
              data-testid="video-compression-output-filename"
              value={outputFileName}
              onChange={(e) => setOutputFileName(e.target.value)}
              disabled={isCompressing}
              className="min-w-0"
            />
          </div>
        </ScrollableDialogBody>

        <ScrollableDialogFooter>
          <Button
            variant="outline"
            onClick={handleCancel}
            disabled={isCompressing}
            data-testid="video-compression-cancel"
          >
            {t("cancel", { ns: "common" })}
          </Button>
          <Button
            className={isCompressing ? "inline-flex items-center gap-2" : undefined}
            onClick={() => void handleStart()}
            disabled={isCompressing}
            data-testid="video-compression-start"
          >
            {isCompressing ? (
              <>
                <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
                {t("videoCompression.start")}
              </>
            ) : (
              t("videoCompression.start")
            )}
          </Button>
        </ScrollableDialogFooter>
      </ScrollableDialogContent>
    </Dialog>
  )
}

function formatDuration(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
  }
  return `${m}:${String(s).padStart(2, "0")}`
}

function formatSizeMB(mb: number): string {
  if (!Number.isFinite(mb) || mb <= 0) return "0 MB"
  if (mb < 1) return `${(mb * 1024).toFixed(0)} KB`
  if (mb < 10) return `${mb.toFixed(1)} MB`
  if (mb < 1024) return `${mb.toFixed(0)} MB`
  return `${(mb / 1024).toFixed(2)} GB`
}
