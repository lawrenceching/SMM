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
  SynthesizeQuality,
  SynthesizeRenderMode,
  SynthesizeSubtitleConfirmPayload,
  SynthesizeSubtitleDialogRow,
  SynthesizeSubtitleLayoutOption,
  SynthesizeSubtitleMode,
  UISynthesizeSubtitleDialogProps,
} from "./types"
import { useTranslation } from "@/lib/i18n"

const SUBTITLE_MODE_OPTIONS: SynthesizeSubtitleMode[] = ["soft", "hard"]
const QUALITY_OPTIONS: SynthesizeQuality[] = ["ultra", "high", "medium", "low"]
const RENDER_MODE_OPTIONS: SynthesizeRenderMode[] = ["ass", "rounded"]
const LAYOUT_OPTIONS: SynthesizeSubtitleLayoutOption[] = [
  "target-above",
  "source-above",
  "target-only",
  "source-only",
]

const LS_SUBTITLE_MODE = "synthesizeSubtitle.subtitleMode"
const LS_QUALITY = "synthesizeSubtitle.quality"

function readStoredSubtitleMode(): SynthesizeSubtitleMode {
  try {
    const v = localStorage.getItem(LS_SUBTITLE_MODE)?.trim()
    if (v === "soft" || v === "hard") return v
  } catch {
    // ignore
  }
  return "soft"
}

function readStoredQuality(): SynthesizeQuality {
  try {
    const v = localStorage.getItem(LS_QUALITY)?.trim()
    if (v === "ultra" || v === "high" || v === "medium" || v === "low") return v
  } catch {
    // ignore
  }
  return "medium"
}

function rowTestId(id: string): string {
  return id.replace(/[^\w-]+/g, "_").slice(0, 120)
}

function computeInitialSelection(
  rows: SynthesizeSubtitleDialogRow[],
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

export function UISynthesizeSubtitleDialog({
  isOpen,
  onClose,
  rows,
  title,
  description,
  defaultSelectedIds,
  videoCaptionerAvailable = true,
  onConfirm,
}: UISynthesizeSubtitleDialogProps) {
  const { t } = useTranslation("components")
  const { t: tDialogs } = useTranslation("dialogs")
  const headerCheckboxRef = useRef<HTMLInputElement>(null)
  const wasOpenRef = useRef(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set())
  const [subtitleMode, setSubtitleMode] = useState<SynthesizeSubtitleMode>("soft")
  const [quality, setQuality] = useState<SynthesizeQuality>("medium")
  const [style, setStyle] = useState("")
  const [renderMode, setRenderMode] = useState<SynthesizeRenderMode | "">("")
  const [layout, setLayout] = useState<SynthesizeSubtitleLayoutOption | "">("")

  const eligibleRows = rows.filter((r) => r.eligible)
  const selectedEligibleCount = eligibleRows.filter((r) => selectedIds.has(r.id)).length

  useEffect(() => {
    if (isOpen && !wasOpenRef.current) {
      setSelectedIds(computeInitialSelection(rows, defaultSelectedIds))
      setSubtitleMode(readStoredSubtitleMode())
      setQuality(readStoredQuality())
      setStyle("")
      setRenderMode("")
      setLayout("")
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

  const toggleRow = useCallback((row: SynthesizeSubtitleDialogRow) => {
    if (!row.eligible) return
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(row.id)) next.delete(row.id)
      else next.add(row.id)
      return next
    })
  }, [])

  const canConfirm = videoCaptionerAvailable && selectedEligibleCount > 0

  const handleConfirm = useCallback(() => {
    if (!canConfirm || !onConfirm) return
    try {
      localStorage.setItem(LS_SUBTITLE_MODE, subtitleMode)
      localStorage.setItem(LS_QUALITY, quality)
    } catch {
      // ignore
    }
    const payload: SynthesizeSubtitleConfirmPayload = {
      selectedIds: [...selectedIds].filter((id) => eligibleRows.some((r) => r.id === id)),
      subtitleMode,
      quality,
      ...(style.trim() ? { style: style.trim() } : {}),
      ...(renderMode !== "" ? { renderMode: renderMode as SynthesizeRenderMode } : {}),
      ...(layout !== "" ? { layout: layout as SynthesizeSubtitleLayoutOption } : {}),
    }
    void onConfirm(payload)
  }, [
    canConfirm,
    onConfirm,
    selectedIds,
    eligibleRows,
    subtitleMode,
    quality,
    style,
    renderMode,
    layout,
  ])

  const dialogTitle = title ?? t("synthesizeSubtitleDialog.title")
  const dialogDescription = description ?? t("synthesizeSubtitleDialog.description")

  const disabledReasonLabel = (key: SynthesizeSubtitleDialogRow["disabledReason"]) => {
    if (key === "synthesizeSubtitleDialog.noSubtitleFile")
      return t("synthesizeSubtitleDialog.noSubtitleFile")
    if (key === "synthesizeSubtitleDialog.notVideoFile") return t("synthesizeSubtitleDialog.notVideoFile")
    return key ?? ""
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <ScrollableDialogContent className="max-w-2xl" data-testid="synthesize-subtitle-dialog">
        <ScrollableDialogHeader>
          <DialogTitle>{dialogTitle}</DialogTitle>
          <DialogDescription>{dialogDescription}</DialogDescription>
        </ScrollableDialogHeader>

        <ScrollableDialogBody>
          <Table data-testid="synthesize-subtitle-dialog-table">
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
                    data-testid="synthesize-subtitle-dialog-select-all"
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
                  <TableRow key={row.id} data-testid={`synthesize-subtitle-dialog-row-${rowTestId(row.id)}`}>
                    <TableCell>
                      <input
                        type="checkbox"
                        role="checkbox"
                        checked={selectedIds.has(row.id)}
                        disabled={!row.eligible}
                        onChange={() => toggleRow(row)}
                        data-testid={`synthesize-subtitle-dialog-row-checkbox-${rowTestId(row.id)}`}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">{row.displayPath || row.subtitlePath || row.title}</div>
                      {row.title && row.displayPath ? (
                        <div className="text-xs text-muted-foreground">{row.title}</div>
                      ) : null}
                      {!row.eligible && row.disabledReason ? (
                        <div className="text-xs text-destructive mt-1">{disabledReasonLabel(row.disabledReason)}</div>
                      ) : null}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label>{t("synthesizeSubtitleDialog.subtitleMode")}</Label>
            <Select
              value={subtitleMode}
              onValueChange={(v) => setSubtitleMode(v as SynthesizeSubtitleMode)}
              disabled={!videoCaptionerAvailable}
            >
              <SelectTrigger data-testid="synthesize-subtitle-dialog-subtitle-mode">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SUBTITLE_MODE_OPTIONS.map((opt) => (
                  <SelectItem key={opt} value={opt}>
                    {t(`synthesizeSubtitleDialog.subtitleModes.${opt}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label>{t("synthesizeSubtitleDialog.quality")}</Label>
            <Select
              value={quality}
              onValueChange={(v) => setQuality(v as SynthesizeQuality)}
              disabled={!videoCaptionerAvailable}
            >
              <SelectTrigger data-testid="synthesize-subtitle-dialog-quality">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {QUALITY_OPTIONS.map((opt) => (
                  <SelectItem key={opt} value={opt}>
                    {t(`synthesizeSubtitleDialog.qualities.${opt}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label>{t("synthesizeSubtitleDialog.style")}</Label>
            <Input
              value={style}
              onChange={(e) => setStyle(e.target.value)}
              placeholder={t("synthesizeSubtitleDialog.stylePlaceholder")}
              disabled={!videoCaptionerAvailable}
              data-testid="synthesize-subtitle-dialog-style"
            />
          </div>

          <div className="grid gap-2">
            <Label>{t("synthesizeSubtitleDialog.renderMode")}</Label>
            <Select
              value={renderMode === "" ? "__none__" : renderMode}
              onValueChange={(v) => setRenderMode(v === "__none__" ? "" : (v as SynthesizeRenderMode))}
              disabled={!videoCaptionerAvailable}
            >
              <SelectTrigger data-testid="synthesize-subtitle-dialog-render-mode">
                <SelectValue placeholder={t("synthesizeSubtitleDialog.renderModeDefault")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">{t("synthesizeSubtitleDialog.renderModeDefault")}</SelectItem>
                {RENDER_MODE_OPTIONS.map((opt) => (
                  <SelectItem key={opt} value={opt}>
                    {t(`synthesizeSubtitleDialog.renderModes.${opt}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label>{t("synthesizeSubtitleDialog.layout")}</Label>
            <Select
              value={layout === "" ? "__none__" : layout}
              onValueChange={(v) =>
                setLayout(v === "__none__" ? "" : (v as SynthesizeSubtitleLayoutOption))
              }
              disabled={!videoCaptionerAvailable}
            >
              <SelectTrigger data-testid="synthesize-subtitle-dialog-layout">
                <SelectValue placeholder={t("synthesizeSubtitleDialog.layoutDefault")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">{t("synthesizeSubtitleDialog.layoutDefault")}</SelectItem>
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
          <Button variant="outline" onClick={onClose}>
            {t("synthesizeSubtitleDialog.cancel")}
          </Button>
          <Button onClick={handleConfirm} disabled={!canConfirm} data-testid="synthesize-subtitle-dialog-confirm">
            {t("synthesizeSubtitleDialog.confirm")}
          </Button>
        </ScrollableDialogFooter>
      </ScrollableDialogContent>
    </Dialog>
  )
}
