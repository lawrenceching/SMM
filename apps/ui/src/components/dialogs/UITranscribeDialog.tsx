import type { ReactNode } from "react"
import { useCallback, useEffect, useRef, useState } from "react"
import { Loader2, CheckCircle2, XCircle, Circle } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
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
  TranscribeAsrEngine,
  TranscribeDialogRow,
  TranscribeOutputFormat,
  TranscribeProvider,
  TranscribeRowStatus,
  UITranscribeDialogProps,
} from "./types"
import { useTranslation } from "@/lib/i18n"

const ASR_OPTIONS: TranscribeAsrEngine[] = ["bijian", "jianying", "whisper-cpp"]
const FORMAT_OPTIONS: TranscribeOutputFormat[] = ["srt", "ass", "txt", "json"]

type TranscribeAsrOptionI18nKey =
  | "transcribe.asr.bijian"
  | "transcribe.asr.jianying"
  | "transcribe.asr.whisperCpp"

function transcribeAsrOptionKey(engine: TranscribeAsrEngine): TranscribeAsrOptionI18nKey {
  switch (engine) {
    case "bijian":
      return "transcribe.asr.bijian"
    case "jianying":
      return "transcribe.asr.jianying"
    case "whisper-cpp":
      return "transcribe.asr.whisperCpp"
    default: {
      const _exhaustive: never = engine
      return _exhaustive
    }
  }
}

function transcribeFormatOptionKey(
  format: TranscribeOutputFormat,
): `transcribe.format.${TranscribeOutputFormat}` {
  return `transcribe.format.${format}`
}

function computeInitialSelection(
  rows: TranscribeDialogRow[],
  defaultSelectedIds: string[] | undefined,
): Set<string> {
  const validIds = new Set(rows.map((r) => r.id))
  if (defaultSelectedIds !== undefined) {
    const next = new Set<string>()
    for (const id of defaultSelectedIds) {
      if (validIds.has(id)) next.add(id)
    }
    return next
  }
  return new Set(rows.map((r) => r.id))
}

function StatusCell({ status }: { status: TranscribeRowStatus }) {
  const { t } = useTranslation("dialogs")

  let icon: ReactNode
  let label: string
  switch (status) {
    case "running":
      icon = <Loader2 className="h-4 w-4 animate-spin text-primary" />
      label = t("transcribe.status.running")
      break
    case "completed":
      icon = <CheckCircle2 className="h-4 w-4 text-green-500" />
      label = t("transcribe.status.completed")
      break
    case "failed":
      icon = <XCircle className="h-4 w-4 text-destructive" />
      label = t("transcribe.status.failed")
      break
    case "pending":
    default:
      icon = <Circle className="h-4 w-4 text-muted-foreground" />
      label = t("transcribe.status.pending")
      break
  }

  return (
    <div className="flex items-center gap-2">
      {icon}
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  )
}

export function UITranscribeDialog({
  isOpen,
  onClose,
  rows,
  folder: _folder,
  title,
  description,
  defaultSelectedIds,
  asrOptionsEnabled = false,
  tencentAsrEnabled = false,
  videoCaptionerAvailable = true,
  disabledAsrEngines,
  onConfirm,
}: UITranscribeDialogProps) {
  const { t } = useTranslation("dialogs")
  const { t: tCommon } = useTranslation("common")
  const headerCheckboxRef = useRef<HTMLInputElement>(null)
  const wasOpenRef = useRef(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set())
  const [provider, setProvider] = useState<TranscribeProvider>("videoCaptioner")
  const [asr, setAsr] = useState<TranscribeAsrEngine>("bijian")
  const [language, setLanguage] = useState("auto")
  const [wordTimestamps, setWordTimestamps] = useState(false)
  const [format, setFormat] = useState<TranscribeOutputFormat>("srt")
  const [tencentBaseUrl, setTencentBaseUrl] = useState("")
  const [tencentApiKey, setTencentApiKey] = useState("")

  useEffect(() => {
    if (isOpen && !wasOpenRef.current) {
      setSelectedIds(computeInitialSelection(rows, defaultSelectedIds))
      setAsr("bijian")
      setLanguage("auto")
      setWordTimestamps(false)
      setFormat("srt")
      setTencentBaseUrl("")
      setTencentApiKey("")
      if (videoCaptionerAvailable) {
        setProvider("videoCaptioner")
      } else if (tencentAsrEnabled) {
        setProvider("tencentAsr")
      } else {
        setProvider("videoCaptioner")
      }
    }
    wasOpenRef.current = isOpen
  }, [
    isOpen,
    rows,
    defaultSelectedIds,
    videoCaptionerAvailable,
    tencentAsrEnabled,
  ])

  const allSelected = rows.length > 0 && selectedIds.size === rows.length
  const someSelected = selectedIds.size > 0 && selectedIds.size < rows.length

  useEffect(() => {
    const el = headerCheckboxRef.current
    if (!el) return
    el.indeterminate = someSelected
  }, [someSelected, allSelected, rows.length])

  const toggleRow = useCallback((id: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (checked) next.add(id)
      else next.delete(id)
      return next
    })
  }, [])

  const toggleSelectAll = useCallback(() => {
    if (allSelected) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(rows.map((r) => r.id)))
    }
  }, [allSelected, rows])

  const showProviderControls =
    Boolean(onConfirm && rows.length > 0 && (videoCaptionerAvailable || tencentAsrEnabled))

  const confirmDisabled =
    selectedIds.size === 0 ||
    (provider === "videoCaptioner" && !videoCaptionerAvailable) ||
    (provider === "tencentAsr" &&
      (!tencentAsrEnabled || !tencentBaseUrl.trim() || !tencentApiKey.trim()))

  const handleConfirm = useCallback(async () => {
    if (!onConfirm || selectedIds.size === 0 || confirmDisabled) return
    if (provider === "videoCaptioner") {
      await onConfirm({
        selectedIds: [...selectedIds],
        provider: "videoCaptioner",
        videoCaptioner: {
          asr,
          language,
          wordTimestamps,
          format,
        },
      })
      return
    }
    await onConfirm({
      selectedIds: [...selectedIds],
      provider: "tencentAsr",
      tencentAsr: {
        baseUrl: tencentBaseUrl.trim(),
        apiKey: tencentApiKey.trim(),
      },
    })
  }, [
    onConfirm,
    selectedIds,
    confirmDisabled,
    provider,
    asr,
    language,
    wordTimestamps,
    format,
    tencentBaseUrl,
    tencentApiKey,
  ])

  const dialogTitle = title ?? t("transcribe.defaultTitle")
  const dialogDescription = description ?? t("transcribe.defaultDescription")

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl" data-testid="transcribe-dialog">
        <DialogHeader>
          <DialogTitle>{dialogTitle}</DialogTitle>
          <DialogDescription>{dialogDescription}</DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[400px] w-full">
          {rows.length === 0 ? (
            <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
              {t("transcribe.noFiles")}
            </div>
          ) : (
            <Table data-testid="transcribe-dialog-table">
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-10 shrink-0 px-0 py-2 text-center">
                    <input
                      ref={headerCheckboxRef}
                      type="checkbox"
                      role="checkbox"
                      className="h-3.5 w-3.5 cursor-pointer"
                      checked={allSelected}
                      onChange={toggleSelectAll}
                      aria-label={t("transcribe.selectAllAria")}
                      data-testid="transcribe-dialog-select-all"
                    />
                  </TableHead>
                  <TableHead className="py-2 px-2">{t("transcribe.columns.filePath")}</TableHead>
                  <TableHead className="py-2 px-2">{t("transcribe.columns.status")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.id} data-testid={`transcribe-dialog-row-${row.id}`}>
                    <TableCell className="w-10 shrink-0 px-0 py-2 text-center align-middle">
                      <input
                        type="checkbox"
                        role="checkbox"
                        className="h-3.5 w-3.5 cursor-pointer"
                        checked={selectedIds.has(row.id)}
                        onChange={(e) => toggleRow(row.id, e.target.checked)}
                        data-testid={`transcribe-dialog-row-checkbox-${row.id}`}
                      />
                    </TableCell>
                    <TableCell className="max-w-px px-2 py-2">
                      <div
                        className="truncate font-mono text-sm"
                        title={row.path}
                      >
                        {row.displayPath ?? row.path}
                      </div>
                    </TableCell>
                    <TableCell className="px-2 py-2">
                      <StatusCell status={row.status} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </ScrollArea>
        {showProviderControls ? (
          <div className="flex flex-col gap-3 pt-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="transcribe-dialog-provider">{t("transcribe.provider.label")}</Label>
              <Select
                value={provider}
                onValueChange={(v) => setProvider(v as TranscribeProvider)}
              >
                <SelectTrigger
                  id="transcribe-dialog-provider"
                  className="w-full max-w-xs"
                  data-testid="transcribe-dialog-provider"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="videoCaptioner" disabled={!videoCaptionerAvailable}>
                    {t("transcribe.provider.videoCaptioner")}
                  </SelectItem>
                  <SelectItem value="tencentAsr" disabled={!tencentAsrEnabled}>
                    {t("transcribe.provider.tencentAsr")}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            {provider === "videoCaptioner" && asrOptionsEnabled ? (
              <>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="transcribe-dialog-asr">{t("transcribe.asr.label")}</Label>
                  <Select
                    value={asr}
                    onValueChange={(v) => setAsr(v as TranscribeAsrEngine)}
                  >
                    <SelectTrigger
                      id="transcribe-dialog-asr"
                      className="w-full max-w-xs"
                      data-testid="transcribe-dialog-asr"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ASR_OPTIONS.map((value) => (
                        <SelectItem
                          key={value}
                          value={value}
                          disabled={disabledAsrEngines?.includes(value) ?? false}
                        >
                          {t(transcribeAsrOptionKey(value))}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="transcribe-dialog-language">{t("transcribe.language.label")}</Label>
                  <Input
                    id="transcribe-dialog-language"
                    className="max-w-xs"
                    value={language}
                    onChange={(e) => setLanguage(e.target.value)}
                    placeholder={t("transcribe.language.placeholder")}
                    data-testid="transcribe-dialog-language"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <input
                    id="transcribe-dialog-word-ts"
                    type="checkbox"
                    className="h-4 w-4 cursor-pointer"
                    checked={wordTimestamps}
                    onChange={(e) => setWordTimestamps(e.target.checked)}
                    data-testid="transcribe-dialog-word-timestamps"
                  />
                  <Label htmlFor="transcribe-dialog-word-ts" className="cursor-pointer font-normal">
                    {t("transcribe.wordTimestamps.label")}
                  </Label>
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="transcribe-dialog-format">{t("transcribe.format.label")}</Label>
                  <Select
                    value={format}
                    onValueChange={(v) => setFormat(v as TranscribeOutputFormat)}
                  >
                    <SelectTrigger
                      id="transcribe-dialog-format"
                      className="w-full max-w-xs"
                      data-testid="transcribe-dialog-format"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {FORMAT_OPTIONS.map((value) => (
                        <SelectItem key={value} value={value}>
                          {t(transcribeFormatOptionKey(value))}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            ) : null}
            {provider === "tencentAsr" ? (
              <>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="transcribe-dialog-tencent-url">{t("transcribe.tencent.baseUrl")}</Label>
                  <Input
                    id="transcribe-dialog-tencent-url"
                    className="w-full"
                    value={tencentBaseUrl}
                    onChange={(e) => setTencentBaseUrl(e.target.value)}
                    placeholder="https://..."
                    autoComplete="off"
                    data-testid="transcribe-dialog-tencent-base-url"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="transcribe-dialog-tencent-key">{t("transcribe.tencent.apiKey")}</Label>
                  <Input
                    id="transcribe-dialog-tencent-key"
                    type="password"
                    className="w-full"
                    value={tencentApiKey}
                    onChange={(e) => setTencentApiKey(e.target.value)}
                    autoComplete="off"
                    data-testid="transcribe-dialog-tencent-api-key"
                  />
                </div>
              </>
            ) : null}
          </div>
        ) : null}
        <div className="flex justify-end gap-2 pt-4">
          <Button variant="outline" onClick={onClose} data-testid="transcribe-dialog-cancel">
            {tCommon("cancel")}
          </Button>
          {onConfirm ? (
            <Button
              onClick={() => void handleConfirm()}
              disabled={confirmDisabled}
              data-testid="transcribe-dialog-confirm"
            >
              {t("transcribe.confirm")}
            </Button>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  )
}
