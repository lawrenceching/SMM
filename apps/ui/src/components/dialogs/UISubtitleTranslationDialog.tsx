import { useCallback, useEffect, useRef, useState } from "react"
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
  SubtitleTranslateLayout,
  SubtitleTranslateTranslator,
  SubtitleTranslationConfirmPayload,
  SubtitleTranslationDialogRow,
  UISubtitleTranslationDialogProps,
} from "./types"
import { useTranslation } from "@/lib/i18n"

const TRANSLATOR_OPTIONS: SubtitleTranslateTranslator[] = ["bing", "google", "llm"]
const LAYOUT_OPTIONS: SubtitleTranslateLayout[] = [
  "target-above",
  "source-above",
  "target-only",
  "source-only",
]

const LS_TRANSLATOR = "subtitleTranslation.translator"
const LS_TARGET_LANG = "subtitleTranslation.targetLanguage"

function readStoredTranslator(): SubtitleTranslateTranslator {
  try {
    const v = localStorage.getItem(LS_TRANSLATOR)?.trim()
    if (v === "google" || v === "llm" || v === "bing") return v
  } catch {
    // ignore
  }
  return "bing"
}

function readStoredTargetLanguage(): string {
  try {
    const v = localStorage.getItem(LS_TARGET_LANG)?.trim()
    if (v) return v
  } catch {
    // ignore
  }
  return "zh-Hans"
}

function computeInitialSelection(
  rows: SubtitleTranslationDialogRow[],
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

export function UISubtitleTranslationDialog({
  isOpen,
  onClose,
  rows,
  title,
  description,
  defaultSelectedIds,
  videoCaptionerAvailable = true,
  onConfirm,
}: UISubtitleTranslationDialogProps) {
  const { t } = useTranslation("components")
  const { t: tDialogs } = useTranslation("dialogs")
  const { t: tCommon } = useTranslation("common")
  const headerCheckboxRef = useRef<HTMLInputElement>(null)
  const wasOpenRef = useRef(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set())
  const [translator, setTranslator] = useState<SubtitleTranslateTranslator>("bing")
  const [targetLanguage, setTargetLanguage] = useState("zh-Hans")
  const [reflect, setReflect] = useState(false)
  const [layout, setLayout] = useState<SubtitleTranslateLayout | "">("")
  const [llmApiKey, setLlmApiKey] = useState("")
  const [llmApiBase, setLlmApiBase] = useState("")
  const [llmModel, setLlmModel] = useState("")

  const eligibleRows = rows.filter((r) => r.eligible)
  const selectedEligibleCount = eligibleRows.filter((r) => selectedIds.has(r.id)).length

  useEffect(() => {
    if (isOpen && !wasOpenRef.current) {
      setSelectedIds(computeInitialSelection(rows, defaultSelectedIds))
      setTranslator(readStoredTranslator())
      setTargetLanguage(readStoredTargetLanguage())
      setReflect(false)
      setLayout("")
      setLlmApiKey("")
      setLlmApiBase("")
      setLlmModel("")
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

  const toggleRow = useCallback((row: SubtitleTranslationDialogRow) => {
    if (!row.eligible) return
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(row.id)) next.delete(row.id)
      else next.add(row.id)
      return next
    })
  }, [])

  const canConfirm =
    videoCaptionerAvailable &&
    selectedEligibleCount > 0 &&
    targetLanguage.trim().length > 0 &&
    (translator !== "llm" || llmApiKey.trim().length > 0)

  const handleConfirm = useCallback(() => {
    if (!canConfirm || !onConfirm) return
    try {
      localStorage.setItem(LS_TRANSLATOR, translator)
      localStorage.setItem(LS_TARGET_LANG, targetLanguage.trim())
    } catch {
      // ignore
    }
    const payload: SubtitleTranslationConfirmPayload = {
      selectedIds: [...selectedIds].filter((id) => eligibleRows.some((r) => r.id === id)),
      translator,
      targetLanguage: targetLanguage.trim(),
      ...(translator === "llm" && reflect ? { reflect: true } : {}),
      ...(layout !== "" ? { layout: layout as SubtitleTranslateLayout } : {}),
      ...(translator === "llm"
        ? {
            llm: {
              apiKey: llmApiKey.trim(),
              ...(llmApiBase.trim() ? { apiBase: llmApiBase.trim() } : {}),
              ...(llmModel.trim() ? { model: llmModel.trim() } : {}),
            },
          }
        : {}),
    }
    void onConfirm(payload)
  }, [
    canConfirm,
    onConfirm,
    selectedIds,
    eligibleRows,
    translator,
    targetLanguage,
    reflect,
    layout,
    llmApiKey,
    llmApiBase,
    llmModel,
  ])

  const dialogTitle = title ?? t("subtitleTranslationDialog.title")
  const dialogDescription = description ?? t("subtitleTranslationDialog.description")

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl" data-testid="subtitle-translation-dialog">
        <DialogHeader>
          <DialogTitle>{dialogTitle}</DialogTitle>
          <DialogDescription>{dialogDescription}</DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[50vh] pr-3">
          <Table data-testid="subtitle-translation-dialog-table">
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <input
                    ref={headerCheckboxRef}
                    type="checkbox"
                    role="checkbox"
                    aria-label={tDialogs("transcribe.selectAllAria")}
                    checked={allEligibleSelected}
                    onChange={toggleSelectAll}
                    disabled={eligibleRows.length === 0}
                    data-testid="subtitle-translation-dialog-select-all"
                  />
                </TableHead>
                <TableHead>{tDialogs("transcribe.columns.filePath")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={2} className="text-muted-foreground">
                    {tDialogs("transcribe.noFiles")}
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((row) => (
                  <TableRow key={row.id} data-testid={`subtitle-translation-dialog-row-${row.id}`}>
                    <TableCell>
                      <input
                        type="checkbox"
                        role="checkbox"
                        checked={selectedIds.has(row.id)}
                        disabled={!row.eligible}
                        onChange={() => toggleRow(row)}
                        data-testid={`subtitle-translation-dialog-row-checkbox-${row.id}`}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">{row.displayPath || row.path || row.title}</div>
                      {row.title && row.displayPath ? (
                        <div className="text-xs text-muted-foreground">{row.title}</div>
                      ) : null}
                      {!row.eligible && row.disabledReason ? (
                        <div className="text-xs text-destructive mt-1">
                          {row.disabledReason === "subtitleTranslationDialog.noSubtitleFile"
                            ? t("subtitleTranslationDialog.noSubtitleFile")
                            : row.disabledReason}
                        </div>
                      ) : null}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </ScrollArea>

        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label>{t("subtitleTranslationDialog.translator")}</Label>
            <Select
              value={translator}
              onValueChange={(v) => setTranslator(v as SubtitleTranslateTranslator)}
              disabled={!videoCaptionerAvailable}
            >
              <SelectTrigger data-testid="subtitle-translation-dialog-translator">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TRANSLATOR_OPTIONS.map((opt) => (
                  <SelectItem key={opt} value={opt}>
                    {t(`subtitleTranslationDialog.translators.${opt}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label>{t("subtitleTranslationDialog.targetLanguage")}</Label>
            <Input
              value={targetLanguage}
              onChange={(e) => setTargetLanguage(e.target.value)}
              placeholder="zh-Hans"
              data-testid="subtitle-translation-dialog-target-language"
            />
          </div>

          {translator === "llm" ? (
            <>
              <div className="grid gap-2">
                <Label>{t("subtitleTranslationDialog.apiKey")}</Label>
                <Input
                  type="password"
                  value={llmApiKey}
                  onChange={(e) => setLlmApiKey(e.target.value)}
                  data-testid="subtitle-translation-dialog-llm-api-key"
                />
              </div>
              <div className="grid gap-2">
                <Label>{t("subtitleTranslationDialog.apiBase")}</Label>
                <Input
                  value={llmApiBase}
                  onChange={(e) => setLlmApiBase(e.target.value)}
                  data-testid="subtitle-translation-dialog-llm-api-base"
                />
              </div>
              <div className="grid gap-2">
                <Label>{t("subtitleTranslationDialog.model")}</Label>
                <Input
                  value={llmModel}
                  onChange={(e) => setLlmModel(e.target.value)}
                  data-testid="subtitle-translation-dialog-llm-model"
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="subtitle-translate-reflect"
                  checked={reflect}
                  onChange={(e) => setReflect(e.target.checked)}
                  data-testid="subtitle-translation-dialog-reflect"
                />
                <Label htmlFor="subtitle-translate-reflect" className="font-normal cursor-pointer">
                  {t("subtitleTranslationDialog.reflect")}
                </Label>
              </div>
            </>
          ) : null}

          <div className="grid gap-2">
            <Label>{t("subtitleTranslationDialog.layout")}</Label>
            <Select
              value={layout || "__none__"}
              onValueChange={(v) => setLayout(v === "__none__" ? "" : (v as SubtitleTranslateLayout))}
            >
              <SelectTrigger data-testid="subtitle-translation-dialog-layout">
                <SelectValue placeholder={t("subtitleTranslationDialog.layoutOptional")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">{t("subtitleTranslationDialog.layoutNone")}</SelectItem>
                {LAYOUT_OPTIONS.map((opt) => (
                  <SelectItem key={opt} value={opt}>
                    {opt}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} data-testid="subtitle-translation-dialog-cancel">
            {tCommon("cancel")}
          </Button>
          <Button onClick={handleConfirm} disabled={!canConfirm} data-testid="subtitle-translation-dialog-confirm">
            {t("subtitleTranslationDialog.confirm")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
