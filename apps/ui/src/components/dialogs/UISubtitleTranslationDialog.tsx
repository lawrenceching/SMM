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
  SubtitleTranslateLayout,
  SubtitleTranslateTranslator,
  SubtitleTranslationConfirmPayload,
  SubtitleTranslationDialogRow,
  UISubtitleTranslationDialogProps,
} from "./types"
import { LlmTranslatorFields } from "./LlmTranslatorFields"
import { useConfig } from "@/hooks/userConfig"
import { useTranslation } from "@/lib/i18n"
import {
  createDefaultLlmTranslatorFieldsValue,
  isLlmTranslatorFieldsValid,
  resolveLlmTranslatorPayload,
  type LlmTranslatorFieldsValue,
  type LlmTranslatorSourceMode,
} from "@/lib/llmTranslatorFields"
import {
  DEFAULT_VIDEOCAPTIONER_TARGET_LANGUAGE,
  VIDEOCAPTIONER_TARGET_LANGUAGES,
  formatVideoCaptionerTargetLanguage,
  normalizeVideoCaptionerTargetLanguage,
} from "@/lib/videoCaptionerTargetLanguages"

// "bing" remains a valid SubtitleTranslateTranslator / VideoCaptioner CLI value, but is
// intentionally omitted from the UI: VideoCaptioner's free Bing provider fetches a token
// from https://edge.microsoft.com/translate/auth, which now returns 404, so Bing jobs fail
// at session init. Upstream tracker:
// https://github.com/WEIFENG2333/VideoCaptioner/issues/1173
const TRANSLATOR_OPTIONS: SubtitleTranslateTranslator[] = ["google", "llm"]
const LAYOUT_OPTIONS: SubtitleTranslateLayout[] = [
  "target-above",
  "source-above",
  "target-only",
  "source-only",
]

const LS_TRANSLATOR = "subtitleTranslation.translator"
const LS_TARGET_LANG = "subtitleTranslation.targetLanguage"
const LS_LLM_MODE = "subtitleTranslation.llmSourceMode"
const LS_LLM_PROVIDER = "subtitleTranslation.llmProviderName"

function readStoredTranslator(): SubtitleTranslateTranslator {
  try {
    const v = localStorage.getItem(LS_TRANSLATOR)?.trim()
    // Do not restore "bing" — option is hidden from UI (see TRANSLATOR_OPTIONS comment).
    if (v === "google" || v === "llm") return v
  } catch {
    // ignore
  }
  return "google"
}

function readStoredTargetLanguage(): string {
  try {
    const v = localStorage.getItem(LS_TARGET_LANG)?.trim()
    if (v) return v
  } catch {
    // ignore
  }
  return DEFAULT_VIDEOCAPTIONER_TARGET_LANGUAGE
}

function readStoredLlmPrefs(): { mode?: LlmTranslatorSourceMode; providerName?: string } {
  try {
    const mode = localStorage.getItem(LS_LLM_MODE)?.trim()
    const providerName = localStorage.getItem(LS_LLM_PROVIDER)?.trim()
    return {
      ...(mode === "configured" || mode === "custom" ? { mode } : {}),
      ...(providerName ? { providerName } : {}),
    }
  } catch {
    return {}
  }
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
  const { t, i18n } = useTranslation("components")
  const { t: tDialogs } = useTranslation("dialogs")
  const { t: tCommon } = useTranslation("common")
  const { userConfig } = useConfig()
  const aiProviders = userConfig.aiProviders
  const headerCheckboxRef = useRef<HTMLInputElement>(null)
  const wasOpenRef = useRef(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set())
  const [translator, setTranslator] = useState<SubtitleTranslateTranslator>("google")
  const [rawTargetLanguage, setTargetLanguage] = useState<string>(DEFAULT_VIDEOCAPTIONER_TARGET_LANGUAGE)
  // Google only accepts VideoCaptioner's fixed code list, so coerce free-form values
  // (e.g. a stored "zh-CN") to a supported code instead of letting the CLI reject them.
  const targetLanguage =
    translator === "google"
      ? normalizeVideoCaptionerTargetLanguage(rawTargetLanguage)
      : rawTargetLanguage
  const uiLanguage = i18n?.language
  const [reflect, setReflect] = useState(false)
  const [layout, setLayout] = useState<SubtitleTranslateLayout | "">("")
  const [llmFields, setLlmFields] = useState<LlmTranslatorFieldsValue>(() =>
    createDefaultLlmTranslatorFieldsValue(undefined, undefined),
  )

  const eligibleRows = rows.filter((r) => r.eligible)
  const selectedEligibleCount = eligibleRows.filter((r) => selectedIds.has(r.id)).length

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    if (isOpen && !wasOpenRef.current) {
      setSelectedIds(computeInitialSelection(rows, defaultSelectedIds))
      setTranslator(readStoredTranslator())
      setTargetLanguage(readStoredTargetLanguage())
      setReflect(false)
      setLayout("")
      setLlmFields(
        createDefaultLlmTranslatorFieldsValue(
          aiProviders,
          userConfig.selectedAIProvider,
          readStoredLlmPrefs(),
        ),
      )
    }
    /* eslint-enable react-hooks/set-state-in-effect */
    wasOpenRef.current = isOpen
  }, [isOpen, rows, defaultSelectedIds, aiProviders, userConfig.selectedAIProvider])

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
    (translator !== "llm" || isLlmTranslatorFieldsValid(llmFields, aiProviders))

  const handleConfirm = useCallback(() => {
    if (!canConfirm || !onConfirm) return
    try {
      localStorage.setItem(LS_TRANSLATOR, translator)
      localStorage.setItem(LS_TARGET_LANG, targetLanguage.trim())
      if (translator === "llm") {
        localStorage.setItem(LS_LLM_MODE, llmFields.mode)
        if (llmFields.providerName.trim()) {
          localStorage.setItem(LS_LLM_PROVIDER, llmFields.providerName.trim())
        }
      }
    } catch {
      // ignore
    }
    const resolvedLlm =
      translator === "llm" ? resolveLlmTranslatorPayload(llmFields, aiProviders) : null
    const payload: SubtitleTranslationConfirmPayload = {
      selectedIds: [...selectedIds].filter((id) => eligibleRows.some((r) => r.id === id)),
      translator,
      targetLanguage: targetLanguage.trim(),
      ...(translator === "llm" && reflect ? { reflect: true } : {}),
      ...(layout !== "" ? { layout: layout as SubtitleTranslateLayout } : {}),
      ...(resolvedLlm ? { llm: resolvedLlm } : {}),
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
    llmFields,
    aiProviders,
  ])

  const dialogTitle = title ?? t("subtitleTranslationDialog.title")
  const dialogDescription = description ?? t("subtitleTranslationDialog.description")

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <ScrollableDialogContent className="max-w-2xl" data-testid="subtitle-translation-dialog">
        <ScrollableDialogHeader>
          <DialogTitle>{dialogTitle}</DialogTitle>
          <DialogDescription>{dialogDescription}</DialogDescription>
        </ScrollableDialogHeader>

        <ScrollableDialogBody>
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
            {translator === "google" ? (
              <Select
                value={targetLanguage}
                onValueChange={setTargetLanguage}
                disabled={!videoCaptionerAvailable}
              >
                <SelectTrigger data-testid="subtitle-translation-dialog-target-language">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {VIDEOCAPTIONER_TARGET_LANGUAGES.map((code) => (
                    <SelectItem key={code} value={code}>
                      {formatVideoCaptionerTargetLanguage(code, uiLanguage)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input
                value={targetLanguage}
                onChange={(e) => setTargetLanguage(e.target.value)}
                placeholder={DEFAULT_VIDEOCAPTIONER_TARGET_LANGUAGE}
                data-testid="subtitle-translation-dialog-target-language"
              />
            )}
          </div>

          {translator === "llm" ? (
            <>
              <LlmTranslatorFields
                value={llmFields}
                onChange={setLlmFields}
                disabled={!videoCaptionerAvailable}
                testIdPrefix="subtitle-translation-dialog"
              />
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
        </ScrollableDialogBody>

        <ScrollableDialogFooter>
          <Button variant="outline" onClick={onClose} data-testid="subtitle-translation-dialog-cancel">
            {tCommon("cancel")}
          </Button>
          <Button onClick={handleConfirm} disabled={!canConfirm} data-testid="subtitle-translation-dialog-confirm">
            {t("subtitleTranslationDialog.confirm")}
          </Button>
        </ScrollableDialogFooter>
      </ScrollableDialogContent>
    </Dialog>
  )
}
