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
  TranscribeRowStatus,
  UITranscribeDialogProps,
} from "./types"
import { useTranslation } from "@/lib/i18n"

const ASR_OPTIONS: TranscribeAsrEngine[] = ["bijian", "jianying", "whisper-cpp"]

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

function computeInitialSelection(
  rows: TranscribeDialogRow[],
  defaultSelectedIds: string[] | undefined
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
  title,
  description,
  defaultSelectedIds,
  asrOptionsEnabled = false,
  disabledAsrEngines,
  onConfirm,
}: UITranscribeDialogProps) {
  const { t } = useTranslation(["dialogs", "common"])
  const headerCheckboxRef = useRef<HTMLInputElement>(null)
  const wasOpenRef = useRef(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set())
  const [asr, setAsr] = useState<TranscribeAsrEngine>("bijian")

  useEffect(() => {
    if (isOpen && !wasOpenRef.current) {
      setSelectedIds(computeInitialSelection(rows, defaultSelectedIds))
      setAsr("bijian")
    }
    wasOpenRef.current = isOpen
  }, [isOpen, rows, defaultSelectedIds])

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

  const handleConfirm = useCallback(async () => {
    if (!onConfirm || selectedIds.size === 0) return
    await onConfirm({ selectedIds: [...selectedIds], asr })
  }, [onConfirm, selectedIds, asr])

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
        {onConfirm && rows.length > 0 && asrOptionsEnabled ? (
          <div className="flex flex-col gap-2 pt-2">
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
        ) : null}
        <div className="flex justify-end gap-2 pt-4">
          <Button variant="outline" onClick={onClose} data-testid="transcribe-dialog-cancel">
            {t("cancel", { ns: "common" })}
          </Button>
          {onConfirm ? (
            <Button
              onClick={() => void handleConfirm()}
              disabled={selectedIds.size === 0}
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
