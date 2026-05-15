import { useCallback, useEffect, useRef, useState } from "react"
import { Dialog, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import {
  ScrollableDialogBody,
  ScrollableDialogContent,
  ScrollableDialogFooter,
  ScrollableDialogHeader,
} from "@/components/ui/scrollable-dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type {
  ProcessPipelineConfirmPayload,
  ProcessPipelineDialogRow,
  SubtitleTranslateLayout,
  SubtitleTranslateTranslator,
  SynthesizeQuality,
  SynthesizeRenderMode,
  SynthesizeSubtitleLayoutOption,
  SynthesizeSubtitleMode,
  TranscribeAsrEngine,
  TranscribeOutputFormat,
  UIProcessPipelineDialogProps,
} from "./types"
import { useTranslation } from "@/lib/i18n"

const ASR_OPTIONS: TranscribeAsrEngine[] = ["bijian", "jianying", "whisper-cpp"]
const FORMAT_OPTIONS: TranscribeOutputFormat[] = ["srt", "ass", "txt", "json"]
const TRANSLATOR_OPTIONS: SubtitleTranslateTranslator[] = ["bing", "google", "llm"]
const SUBTITLE_MODE_OPTIONS: SynthesizeSubtitleMode[] = ["soft", "hard"]
const QUALITY_OPTIONS: SynthesizeQuality[] = ["ultra", "high", "medium", "low"]
const RENDER_MODE_OPTIONS: SynthesizeRenderMode[] = ["ass", "rounded"]
const LAYOUT_OPTIONS: SubtitleTranslateLayout[] = [
  "target-above",
  "source-above",
  "target-only",
  "source-only",
]

const LS_ASR = "processPipeline.asr"
const LS_FORMAT = "processPipeline.format"
const LS_TRANSLATOR = "processPipeline.translator"
const LS_TARGET_LANG = "processPipeline.targetLanguage"
const LS_NO_SYNTH = "processPipeline.noSynthesize"

function readStoredAsr(): TranscribeAsrEngine {
  try {
    const v = localStorage.getItem(LS_ASR)?.trim()
    if (v === "bijian" || v === "jianying" || v === "whisper-cpp") return v
  } catch {
    // ignore
  }
  return "bijian"
}

function readStoredFormat(): TranscribeOutputFormat {
  try {
    const v = localStorage.getItem(LS_FORMAT)?.trim()
    if (v === "srt" || v === "ass" || v === "txt" || v === "json") return v
  } catch {
    // ignore
  }
  return "srt"
}

function readStoredTranslator(): SubtitleTranslateTranslator {
  try {
    const v = localStorage.getItem(LS_TRANSLATOR)?.trim()
    if (v === "bing" || v === "google" || v === "llm") return v
  } catch {
    // ignore
  }
  return "bing"
}

function readStoredTargetLanguage(): string {
  try {
    return localStorage.getItem(LS_TARGET_LANG)?.trim() || "en"
  } catch {
    return "en"
  }
}

function readStoredNoSynthesize(): boolean {
  try {
    const v = localStorage.getItem(LS_NO_SYNTH)
    if (v === "false") return false
  } catch {
    // ignore
  }
  return true
}

function computeInitialSelection(
  rows: ProcessPipelineDialogRow[],
  defaultSelectedIds: string[] | undefined,
): Set<string> {
  const eligibleIds = new Set(rows.filter((r) => r.eligible).map((r) => r.id))
  if (defaultSelectedIds !== undefined) {
    const next = new Set<string>()
    for (const id of defaultSelectedIds) {
      if (eligibleIds.has(id)) next.add(id)
    }
    return next
  }
  return eligibleIds
}

export function UIProcessPipelineDialog({
  isOpen,
  onClose,
  rows,
  title,
  description,
  defaultSelectedIds,
  videoCaptionerAvailable = true,
  asrOptionsEnabled = true,
  disabledAsrEngines,
  onConfirm,
}: UIProcessPipelineDialogProps) {
  const { t } = useTranslation("components")
  const { t: tDialogs } = useTranslation("dialogs")
  const { t: tCommon } = useTranslation("common")
  const headerCheckboxRef = useRef<HTMLInputElement>(null)
  const wasOpenRef = useRef(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set())
  const [asr, setAsr] = useState<TranscribeAsrEngine>("bijian")
  const [language, setLanguage] = useState("auto")
  const [wordTimestamps, setWordTimestamps] = useState(false)
  const [format, setFormat] = useState<TranscribeOutputFormat>("srt")
  const [noOptimize, setNoOptimize] = useState(false)
  const [noTranslate, setNoTranslate] = useState(false)
  const [noSplit, setNoSplit] = useState(false)
  const [translator, setTranslator] = useState<SubtitleTranslateTranslator>("bing")
  const [targetLanguage, setTargetLanguage] = useState("en")
  const [reflect, setReflect] = useState(false)
  const [layout, setLayout] = useState<SubtitleTranslateLayout | "">("")
  const [prompt, setPrompt] = useState("")
  const [llmApiKey, setLlmApiKey] = useState("")
  const [llmApiBase, setLlmApiBase] = useState("")
  const [llmModel, setLlmModel] = useState("")
  const [noSynthesize, setNoSynthesize] = useState(true)
  const [subtitleMode, setSubtitleMode] = useState<SynthesizeSubtitleMode>("soft")
  const [quality, setQuality] = useState<SynthesizeQuality>("medium")
  const [style, setStyle] = useState("")
  const [renderMode, setRenderMode] = useState<SynthesizeRenderMode | "">("")
  const [synthesizeLayout, setSynthesizeLayout] = useState<SynthesizeSubtitleLayoutOption | "">("")

  const eligibleRows = rows.filter((r) => r.eligible)
  const selectedEligibleCount = eligibleRows.filter((r) => selectedIds.has(r.id)).length

  useEffect(() => {
    if (isOpen && !wasOpenRef.current) {
      setSelectedIds(computeInitialSelection(rows, defaultSelectedIds))
      setAsr(readStoredAsr())
      setFormat(readStoredFormat())
      setTranslator(readStoredTranslator())
      setTargetLanguage(readStoredTargetLanguage())
      setNoSynthesize(readStoredNoSynthesize())
      setLanguage("auto")
      setWordTimestamps(false)
      setNoOptimize(false)
      setNoTranslate(false)
      setNoSplit(false)
      setReflect(false)
      setLayout("")
      setPrompt("")
      setLlmApiKey("")
      setLlmApiBase("")
      setLlmModel("")
      setSubtitleMode("soft")
      setQuality("medium")
      setStyle("")
      setRenderMode("")
      setSynthesizeLayout("")
    }
    wasOpenRef.current = isOpen
  }, [isOpen, rows, defaultSelectedIds])

  const allEligibleSelected =
    eligibleRows.length > 0 && eligibleRows.every((r) => selectedIds.has(r.id))

  useEffect(() => {
    const el = headerCheckboxRef.current
    if (!el) return
    el.indeterminate = selectedEligibleCount > 0 && !allEligibleSelected
  }, [selectedEligibleCount, allEligibleSelected])

  const toggleSelectAll = useCallback(() => {
    setSelectedIds(() => {
      if (allEligibleSelected) return new Set()
      return new Set(eligibleRows.map((r) => r.id))
    })
  }, [allEligibleSelected, eligibleRows])

  const toggleRow = useCallback((row: ProcessPipelineDialogRow) => {
    if (!row.eligible) return
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(row.id)) next.delete(row.id)
      else next.add(row.id)
      return next
    })
  }, [])

  const asrBlocked = disabledAsrEngines?.includes(asr) ?? false
  const translateOk = noTranslate || (Boolean(translator) && targetLanguage.trim().length > 0)
  const llmOk = translator !== "llm" || noTranslate || llmApiKey.trim().length > 0
  const canConfirm =
    videoCaptionerAvailable && selectedEligibleCount > 0 && !asrBlocked && translateOk && llmOk

  const handleConfirm = useCallback(() => {
    if (!canConfirm || !onConfirm) return
    try {
      localStorage.setItem(LS_ASR, asr)
      localStorage.setItem(LS_FORMAT, format)
      localStorage.setItem(LS_TRANSLATOR, translator)
      localStorage.setItem(LS_TARGET_LANG, targetLanguage.trim())
      localStorage.setItem(LS_NO_SYNTH, noSynthesize ? "true" : "false")
    } catch {
      // ignore
    }
    const payload: ProcessPipelineConfirmPayload = {
      selectedIds: [...selectedIds].filter((id) => eligibleRows.some((r) => r.id === id)),
      asr,
      language: language.trim() || "auto",
      wordTimestamps,
      format,
      noOptimize,
      noTranslate,
      noSplit,
      reflect,
      ...(prompt.trim() ? { prompt: prompt.trim() } : {}),
      noSynthesize,
      ...(noTranslate
        ? {}
        : {
            translator,
            targetLanguage: targetLanguage.trim(),
            ...(translator === "llm" && llmApiKey.trim()
              ? {
                  llm: {
                    apiKey: llmApiKey.trim(),
                    ...(llmApiBase.trim() ? { apiBase: llmApiBase.trim() } : {}),
                    ...(llmModel.trim() ? { model: llmModel.trim() } : {}),
                  },
                }
              : {}),
          }),
      ...(layout !== "" ? { layout: layout as SubtitleTranslateLayout } : {}),
      ...(!noSynthesize
        ? {
            subtitleMode,
            quality,
            ...(style.trim() ? { style: style.trim() } : {}),
            ...(renderMode !== "" ? { renderMode: renderMode as SynthesizeRenderMode } : {}),
            ...(synthesizeLayout !== ""
              ? { synthesizeLayout: synthesizeLayout as SynthesizeSubtitleLayoutOption }
              : {}),
          }
        : {}),
    }
    void onConfirm(payload)
  }, [
    canConfirm,
    onConfirm,
    selectedIds,
    eligibleRows,
    asr,
    language,
    wordTimestamps,
    format,
    noOptimize,
    noTranslate,
    noSplit,
    translator,
    targetLanguage,
    reflect,
    layout,
    prompt,
    llmApiKey,
    llmApiBase,
    llmModel,
    noSynthesize,
    subtitleMode,
    quality,
    style,
    renderMode,
    synthesizeLayout,
  ])

  const dialogTitle = title ?? t("processPipelineDialog.title")
  const dialogDescription = description ?? t("processPipelineDialog.description")

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <ScrollableDialogContent className="max-w-2xl sm:max-w-2xl" data-testid="process-pipeline-dialog">
        <ScrollableDialogHeader>
          <DialogTitle>{dialogTitle}</DialogTitle>
          <DialogDescription>{dialogDescription}</DialogDescription>
        </ScrollableDialogHeader>

        <ScrollableDialogBody>
          <Table className="table-fixed" data-testid="process-pipeline-dialog-table">
            <TableHeader>
              <TableRow>
                <TableHead className="w-10 max-w-10">
                  <input
                    ref={headerCheckboxRef}
                    type="checkbox"
                    role="checkbox"
                    aria-label={tDialogs("transcribe.selectAllAria")}
                    checked={allEligibleSelected}
                    onChange={toggleSelectAll}
                    disabled={eligibleRows.length === 0}
                    data-testid="process-pipeline-dialog-select-all"
                  />
                </TableHead>
                <TableHead className="min-w-0">
                  {tDialogs("transcribe.columns.filePath")}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id} data-testid={`process-pipeline-dialog-row-${row.id.slice(0, 40)}`}>
                  <TableCell className="w-10 max-w-10 align-top">
                    <input
                      type="checkbox"
                      role="checkbox"
                      checked={selectedIds.has(row.id)}
                      disabled={!row.eligible}
                      onChange={() => toggleRow(row)}
                      data-testid={`process-pipeline-dialog-check-${row.id.slice(0, 40)}`}
                    />
                  </TableCell>
                  <TableCell className="min-w-0 whitespace-normal wrap-break-word text-sm align-top">
                    {row.displayPath ?? row.mediaPath}
                    {!row.eligible && row.disabledReason ? (
                      <span className="mt-1 block text-xs text-muted-foreground">
                        {t(row.disabledReason as "processPipelineDialog.noMediaPath")}
                      </span>
                    ) : null}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <div className="space-y-3 border-t pt-3">
          {asrOptionsEnabled ? (
            <div className="space-y-1">
              <Label>{tDialogs("transcribe.asr.label")}</Label>
              <Select value={asr} onValueChange={(v) => setAsr(v as TranscribeAsrEngine)}>
                <SelectTrigger data-testid="process-pipeline-asr">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ASR_OPTIONS.map((value) => (
                    <SelectItem key={value} value={value} disabled={disabledAsrEngines?.includes(value)}>
                      {tDialogs(
                        `transcribe.asr.${value === "whisper-cpp" ? "whisperCpp" : value}` as
                          | "transcribe.asr.bijian"
                          | "transcribe.asr.jianying"
                          | "transcribe.asr.whisperCpp",
                      )}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label htmlFor="process-lang">{t("processPipelineDialog.language")}</Label>
              <Input
                id="process-lang"
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                data-testid="process-pipeline-language"
              />
            </div>
            <div className="space-y-1">
              <Label>{t("processPipelineDialog.format")}</Label>
              <Select value={format} onValueChange={(v) => setFormat(v as TranscribeOutputFormat)}>
                <SelectTrigger data-testid="process-pipeline-format">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FORMAT_OPTIONS.map((f) => (
                    <SelectItem key={f} value={f}>
                      {f}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={wordTimestamps}
              onChange={(e) => setWordTimestamps(e.target.checked)}
              data-testid="process-pipeline-word-ts"
            />
            {t("processPipelineDialog.wordTimestamps")}
          </label>

          <div className="space-y-2 border-t pt-2">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={noOptimize}
                onChange={(e) => setNoOptimize(e.target.checked)}
              />
              {t("processPipelineDialog.noOptimize")}
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={noSplit}
                onChange={(e) => setNoSplit(e.target.checked)}
              />
              {t("processPipelineDialog.noSplit")}
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={noTranslate}
                onChange={(e) => setNoTranslate(e.target.checked)}
              />
              {t("processPipelineDialog.noTranslate")}
            </label>
            {!noTranslate ? (
              <>
                <div className="space-y-1">
                  <Label>{t("processPipelineDialog.translator")}</Label>
                  <Select value={translator} onValueChange={(v) => setTranslator(v as SubtitleTranslateTranslator)}>
                    <SelectTrigger data-testid="process-pipeline-translator">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TRANSLATOR_OPTIONS.map((tr) => (
                        <SelectItem key={tr} value={tr}>
                          {tr}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="process-tgt">{t("processPipelineDialog.targetLanguage")}</Label>
                  <Input
                    id="process-tgt"
                    value={targetLanguage}
                    onChange={(e) => setTargetLanguage(e.target.value)}
                    data-testid="process-pipeline-target-lang"
                  />
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={reflect} onChange={(e) => setReflect(e.target.checked)} />
                  {t("processPipelineDialog.reflect")}
                </label>
                <div className="space-y-1">
                  <Label>{t("processPipelineDialog.subtitleLayout")}</Label>
                  <Select value={layout || "__none__"} onValueChange={(v) => setLayout(v === "__none__" ? "" : (v as SubtitleTranslateLayout))}>
                    <SelectTrigger>
                      <SelectValue placeholder={t("processPipelineDialog.layoutOptional")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">{t("processPipelineDialog.layoutOptional")}</SelectItem>
                      {LAYOUT_OPTIONS.map((lo) => (
                        <SelectItem key={lo} value={lo}>
                          {lo}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="process-prompt">{t("processPipelineDialog.promptOptional")}</Label>
                  <Input id="process-prompt" value={prompt} onChange={(e) => setPrompt(e.target.value)} />
                </div>
                {translator === "llm" ? (
                  <div className="space-y-2 rounded border p-2">
                    <div className="space-y-1">
                      <Label>{t("processPipelineDialog.llmApiKey")}</Label>
                      <Input value={llmApiKey} onChange={(e) => setLlmApiKey(e.target.value)} type="password" />
                    </div>
                    <div className="space-y-1">
                      <Label>{t("processPipelineDialog.llmApiBase")}</Label>
                      <Input value={llmApiBase} onChange={(e) => setLlmApiBase(e.target.value)} />
                    </div>
                    <div className="space-y-1">
                      <Label>{t("processPipelineDialog.llmModel")}</Label>
                      <Input value={llmModel} onChange={(e) => setLlmModel(e.target.value)} />
                    </div>
                  </div>
                ) : null}
              </>
            ) : null}
          </div>

          <label className="flex items-center gap-2 text-sm border-t pt-2">
            <input
              type="checkbox"
              checked={noSynthesize}
              onChange={(e) => setNoSynthesize(e.target.checked)}
              data-testid="process-pipeline-no-synthesize"
            />
            {t("processPipelineDialog.noSynthesize")}
          </label>

          {!noSynthesize ? (
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label>{t("processPipelineDialog.subtitleMode")}</Label>
                <Select value={subtitleMode} onValueChange={(v) => setSubtitleMode(v as SynthesizeSubtitleMode)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SUBTITLE_MODE_OPTIONS.map((m) => (
                      <SelectItem key={m} value={m}>
                        {m}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>{t("processPipelineDialog.quality")}</Label>
                <Select value={quality} onValueChange={(v) => setQuality(v as SynthesizeQuality)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {QUALITY_OPTIONS.map((q) => (
                      <SelectItem key={q} value={q}>
                        {q}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1 col-span-2">
                <Label htmlFor="process-style">{t("processPipelineDialog.styleOptional")}</Label>
                <Input id="process-style" value={style} onChange={(e) => setStyle(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>{t("processPipelineDialog.renderMode")}</Label>
                <Select
                  value={renderMode || "__none__"}
                  onValueChange={(v) => setRenderMode(v === "__none__" ? "" : (v as SynthesizeRenderMode))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="—" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">—</SelectItem>
                    {RENDER_MODE_OPTIONS.map((r) => (
                      <SelectItem key={r} value={r}>
                        {r}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>{t("processPipelineDialog.synthesizeLayout")}</Label>
                <Select
                  value={synthesizeLayout || "__none__"}
                  onValueChange={(v) =>
                    setSynthesizeLayout(v === "__none__" ? "" : (v as SynthesizeSubtitleLayoutOption))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="—" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">—</SelectItem>
                    {LAYOUT_OPTIONS.map((lo) => (
                      <SelectItem key={lo} value={lo}>
                        {lo}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          ) : null}
        </div>
        </ScrollableDialogBody>

        <ScrollableDialogFooter>
          <Button variant="outline" onClick={onClose}>
            {tCommon("cancel")}
          </Button>
          <Button onClick={handleConfirm} disabled={!canConfirm} data-testid="process-pipeline-confirm">
            {tDialogs("transcribe.confirm")}
          </Button>
        </ScrollableDialogFooter>
      </ScrollableDialogContent>
    </Dialog>
  )
}
