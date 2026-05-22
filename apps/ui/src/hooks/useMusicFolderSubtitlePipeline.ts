import { useCallback, useMemo, useState } from "react"
import { toast } from "sonner"
import { Path } from "@core/path"
import type { LocalFileTableRowData } from "@/components/MusicFileTable"
import { useFileStatuses } from "@/hooks/useJobOrchestrator"
import { useJobManager } from "@/hooks/useJobManager"
import { useFeatures } from "@/hooks/useFeatures"
import { useVideoCaptionerStatus } from "@/hooks/useVideoCaptionerStatus"
import {
  absolutePosixMusicFilePath,
  transcribeDialogRowsFromMusicFileRows,
} from "@/lib/transcribeDialogRows"
import { subtitleTranslationDialogRowsFromMusicFileRows } from "@/lib/subtitleTranslationDialogRows"
import { synthesizeSubtitleDialogRowsFromMusicFileRows } from "@/lib/synthesizeSubtitleDialogRows"
import { processPipelineDialogRowsFromMusicFileRows } from "@/lib/processPipelineDialogRows"

export type SubtitlePipelineType = "transcribe" | "translate" | "synthesize" | "process"

export type SubtitleIndexColumnVariant = "index" | "checkbox" | "spinner" | "failed"

export interface RowSubtitlePipelineState {
  transcribeStatus?: "running" | "failed"
  translateStatus?: "running" | "failed"
  synthesizeStatus?: "running" | "failed"
  processStatus?: "running" | "failed"
  canTranslate: boolean
  canSynthesize: boolean
  canProcess: boolean
}

export interface RowSubtitleUi extends RowSubtitlePipelineState {
  indexColumnVariant: SubtitleIndexColumnVariant
  indexColumnTooltip?: string
  titleTooltip: string
  submenuDisabled: boolean
  transcribeStartDisabled: boolean
  translateStartDisabled: boolean
  synthesizeStartDisabled: boolean
  processStartDisabled: boolean
}

export interface MusicFolderSubtitlePipelineInput {
  platformFolder: string
  mediaFolderPath?: string
  folderFiles?: string[] | null
  localRows: LocalFileTableRowData[]
  selectedLocalRows: LocalFileTableRowData[]
  onClearSelection?: () => void
}

function pathStatus(
  abs: string | undefined,
  running: Set<string>,
  failed: Set<string>,
): "running" | "failed" | undefined {
  if (!abs) return undefined
  if (running.has(abs)) return "running"
  if (failed.has(abs)) return "failed"
  return undefined
}

export function getRowSubtitlePipelineState(
  row: LocalFileTableRowData,
  mediaFolderPath: string | undefined,
  transcribingPaths: Set<string>,
  transcribeFailedPaths: Set<string>,
  translatingPaths: Set<string>,
  translateFailedPaths: Set<string>,
  synthesizingPaths: Set<string>,
  synthesizeFailedPaths: Set<string>,
  processingPaths: Set<string>,
  processFailedPaths: Set<string>,
  translateEligibleByMediaPath: Map<string, boolean>,
  synthesizeEligibleByMediaPath: Map<string, boolean>,
  isProcessAvailable: boolean,
): RowSubtitlePipelineState {
  const abs = absolutePosixMusicFilePath(row, mediaFolderPath)
  return {
    transcribeStatus: pathStatus(abs, transcribingPaths, transcribeFailedPaths),
    translateStatus: pathStatus(abs, translatingPaths, translateFailedPaths),
    synthesizeStatus: pathStatus(abs, synthesizingPaths, synthesizeFailedPaths),
    processStatus: pathStatus(abs, processingPaths, processFailedPaths),
    canTranslate: abs ? (translateEligibleByMediaPath.get(abs) ?? false) : false,
    canSynthesize: abs ? (synthesizeEligibleByMediaPath.get(abs) ?? false) : false,
    canProcess: isProcessAvailable,
  }
}

export function buildRowSubtitleUi(
  row: LocalFileTableRowData,
  state: RowSubtitlePipelineState,
  isMultiSelectMode: boolean,
  isSelected: boolean,
  isTranscribeAvailable: boolean,
  isTranslateAvailable: boolean,
  isSynthesizeAvailable: boolean,
  isProcessAvailable: boolean,
  t: (key: string) => string,
): RowSubtitleUi {
  const isTranscribing = state.transcribeStatus === "running"
  const isTranslating = state.translateStatus === "running"
  const isSynthesizing = state.synthesizeStatus === "running"
  const isProcessing = state.processStatus === "running"

  const subtitleRunKind = isProcessing
    ? "process-run"
    : isSynthesizing
      ? "synthesize-run"
      : isTranslating
        ? "translate-run"
        : isTranscribing
          ? "transcribe-run"
          : state.processStatus === "failed" && !isProcessing
            ? "subtitle-failed"
            : state.synthesizeStatus === "failed" && !isSynthesizing
              ? "subtitle-failed"
              : state.translateStatus === "failed" && !isTranslating
                ? "subtitle-failed"
                : state.transcribeStatus === "failed" && !isTranscribing
                  ? "subtitle-failed"
                  : null

  const indexColumnTooltip =
    subtitleRunKind === "transcribe-run"
      ? t("mediaPlayer.transcribingTooltip")
      : subtitleRunKind === "translate-run"
        ? t("mediaPlayer.translateRunningTooltip")
        : subtitleRunKind === "synthesize-run"
          ? t("mediaPlayer.synthesizeRunningTooltip")
          : subtitleRunKind === "process-run"
            ? t("mediaPlayer.processRunningTooltip")
            : undefined

  const indexColumnVariant: SubtitleIndexColumnVariant = indexColumnTooltip
    ? "spinner"
    : subtitleRunKind === "subtitle-failed"
      ? "failed"
      : isMultiSelectMode || isSelected
        ? "checkbox"
        : "index"

  const titleTooltip = isProcessing
    ? t("mediaPlayer.processRunningTooltip")
    : state.processStatus === "failed" && !isProcessing
      ? t("mediaPlayer.processFailedTooltip")
      : isTranslating
        ? t("mediaPlayer.translateRunningTooltip")
        : state.translateStatus === "failed" && !isTranslating
          ? t("mediaPlayer.translateFailedTooltip")
          : isSynthesizing
            ? t("mediaPlayer.synthesizeRunningTooltip")
            : state.synthesizeStatus === "failed" && !isSynthesizing
              ? t("mediaPlayer.synthesizeFailedTooltip")
              : isTranscribing
                ? t("mediaPlayer.transcribingTooltip")
                : state.transcribeStatus === "failed"
                  ? t("mediaPlayer.transcribeFailedTooltip")
                  : row.title

  const submenuDisabled = !(
    state.transcribeStatus === "running" ||
    (isTranscribeAvailable && !isTranscribing) ||
    (isTranslateAvailable && state.canTranslate && !isTranslating) ||
    state.translateStatus === "running" ||
    (isSynthesizeAvailable && state.canSynthesize && !isSynthesizing) ||
    state.synthesizeStatus === "running" ||
    state.processStatus === "running" ||
    (isProcessAvailable && state.canProcess !== false && !isProcessing)
  )

  return {
    ...state,
    indexColumnVariant,
    indexColumnTooltip,
    titleTooltip,
    submenuDisabled,
    transcribeStartDisabled: !isTranscribeAvailable || isTranscribing,
    translateStartDisabled:
      !isTranslateAvailable || !state.canTranslate || isTranslating,
    synthesizeStartDisabled:
      !isSynthesizeAvailable || !state.canSynthesize || isSynthesizing,
    processStartDisabled:
      !isProcessAvailable || state.canProcess === false || isProcessing,
  }
}

export function useMusicFolderSubtitlePipeline({
  platformFolder,
  mediaFolderPath,
  folderFiles,
  localRows,
  selectedLocalRows,
  onClearSelection,
}: MusicFolderSubtitlePipelineInput) {
  const { stopJob } = useJobManager()
  const { isTranscribeEnabled, isTencentAsrTranscribeEnabled } = useFeatures()
  const { isAvailable: isVideoCaptionerReady } = useVideoCaptionerStatus()

  const isTranscribeAvailable =
    isTranscribeEnabled && (isVideoCaptionerReady || isTencentAsrTranscribeEnabled)
  const isTranslateAvailable = isVideoCaptionerReady
  const isSynthesizeAvailable = isVideoCaptionerReady
  const isProcessAvailable = isTranscribeEnabled && isVideoCaptionerReady

  const {
    runningPaths: transcribingPaths,
    failedPaths: transcribeFailedPaths,
    primaryJobIdByPath: transcribeJobIdByPath,
  } = useFileStatuses(platformFolder, "transcribe")
  const {
    runningPaths: translatingPaths,
    failedPaths: translateFailedPaths,
    primaryJobIdByPath: translateJobIdByPath,
  } = useFileStatuses(platformFolder, "translate")
  const {
    runningPaths: synthesizingPaths,
    failedPaths: synthesizeFailedPaths,
    primaryJobIdByPath: synthesizeJobIdByPath,
  } = useFileStatuses(platformFolder, "synthesize")
  const {
    runningPaths: processingPaths,
    failedPaths: processFailedPaths,
    primaryJobIdByPath: processJobIdByPath,
  } = useFileStatuses(platformFolder, "process")

  const subtitleTranslationDialogRows = useMemo(
    () =>
      subtitleTranslationDialogRowsFromMusicFileRows(
        localRows,
        mediaFolderPath,
        folderFiles,
      ),
    [localRows, mediaFolderPath, folderFiles],
  )

  const synthesizeSubtitleDialogRows = useMemo(
    () =>
      synthesizeSubtitleDialogRowsFromMusicFileRows(
        localRows,
        mediaFolderPath,
        folderFiles,
      ),
    [localRows, mediaFolderPath, folderFiles],
  )

  const translateEligibleByMediaPath = useMemo(() => {
    const m = new Map<string, boolean>()
    for (const r of subtitleTranslationDialogRows) {
      if (r.mediaPath) m.set(r.mediaPath, r.eligible)
    }
    return m
  }, [subtitleTranslationDialogRows])

  const synthesizeEligibleByMediaPath = useMemo(() => {
    const m = new Map<string, boolean>()
    for (const r of synthesizeSubtitleDialogRows) {
      if (r.videoPath) m.set(r.videoPath, r.eligible)
    }
    return m
  }, [synthesizeSubtitleDialogRows])

  const transcribeDialogRows = useMemo(
    () => transcribeDialogRowsFromMusicFileRows(localRows, mediaFolderPath),
    [localRows, mediaFolderPath],
  )

  const processPipelineRows = useMemo(
    () => processPipelineDialogRowsFromMusicFileRows(localRows, mediaFolderPath),
    [localRows, mediaFolderPath],
  )

  const hasTranscribeTargets = transcribeDialogRows.length > 0
  const hasProcessTargets = processPipelineRows.length > 0
  const hasTranslateTargets = subtitleTranslationDialogRows.some((r) => r.eligible)
  const hasSynthesizeTargets = synthesizeSubtitleDialogRows.some((r) => r.eligible)

  const dialogFolder = mediaFolderPath
    ? Path.toPlatformPath(mediaFolderPath)
    : undefined

  const [isTranscribeOpen, setIsTranscribeOpen] = useState(false)
  const [transcribeDialogDefaultSelectedIds, setTranscribeDialogDefaultSelectedIds] =
    useState<string[] | undefined>(undefined)
  const [isSubtitleTranslationOpen, setIsSubtitleTranslationOpen] = useState(false)
  const [subtitleTranslationDefaultSelectedIds, setSubtitleTranslationDefaultSelectedIds] =
    useState<string[] | undefined>(undefined)
  const [isSynthesizeSubtitleOpen, setIsSynthesizeSubtitleOpen] = useState(false)
  const [synthesizeSubtitleDefaultSelectedIds, setSynthesizeSubtitleDefaultSelectedIds] =
    useState<string[] | undefined>(undefined)
  const [isProcessPipelineOpen, setIsProcessPipelineOpen] = useState(false)
  const [processPipelineDefaultSelectedIds, setProcessPipelineDefaultSelectedIds] =
    useState<string[] | undefined>(undefined)

  const stopPipelineJob = useCallback(
    (row: LocalFileTableRowData, type: SubtitlePipelineType) => {
      const abs = absolutePosixMusicFilePath(row, mediaFolderPath)
      if (!abs) return
      const map =
        type === "transcribe"
          ? transcribeJobIdByPath
          : type === "translate"
            ? translateJobIdByPath
            : type === "synthesize"
              ? synthesizeJobIdByPath
              : processJobIdByPath
      const jobId = map.get(abs)
      if (jobId) stopJob(jobId)
    },
    [
      mediaFolderPath,
      transcribeJobIdByPath,
      translateJobIdByPath,
      synthesizeJobIdByPath,
      processJobIdByPath,
      stopJob,
    ],
  )

  const getRowPipelineState = useCallback(
    (row: LocalFileTableRowData): RowSubtitlePipelineState =>
      getRowSubtitlePipelineState(
        row,
        mediaFolderPath,
        transcribingPaths,
        transcribeFailedPaths,
        translatingPaths,
        translateFailedPaths,
        synthesizingPaths,
        synthesizeFailedPaths,
        processingPaths,
        processFailedPaths,
        translateEligibleByMediaPath,
        synthesizeEligibleByMediaPath,
        isProcessAvailable,
      ),
    [
      mediaFolderPath,
      transcribingPaths,
      transcribeFailedPaths,
      translatingPaths,
      translateFailedPaths,
      synthesizingPaths,
      synthesizeFailedPaths,
      processingPaths,
      processFailedPaths,
      translateEligibleByMediaPath,
      synthesizeEligibleByMediaPath,
      isProcessAvailable,
    ],
  )

  const openTranscribe = useCallback(
    (defaultSelectedIds?: string[]) => {
      if (!hasTranscribeTargets) {
        toast.error("No media files available to transcribe.")
        return
      }
      setTranscribeDialogDefaultSelectedIds(defaultSelectedIds)
      setIsTranscribeOpen(true)
    },
    [hasTranscribeTargets],
  )

  const openTranslate = useCallback(
    (defaultSelectedIds?: string[]) => {
      if (!hasTranslateTargets) {
        toast.error("No subtitle files available to translate.")
        return
      }
      setSubtitleTranslationDefaultSelectedIds(defaultSelectedIds)
      setIsSubtitleTranslationOpen(true)
    },
    [hasTranslateTargets],
  )

  const openSynthesize = useCallback(
    (defaultSelectedIds?: string[]) => {
      if (!hasSynthesizeTargets) {
        toast.error("No video and subtitle pairs available to synthesize.")
        return
      }
      setSynthesizeSubtitleDefaultSelectedIds(defaultSelectedIds)
      setIsSynthesizeSubtitleOpen(true)
    },
    [hasSynthesizeTargets],
  )

  const openProcess = useCallback(
    (defaultSelectedIds?: string[]) => {
      if (!hasProcessTargets) {
        toast.error("No media files available for the pipeline.")
        return
      }
      setProcessPipelineDefaultSelectedIds(defaultSelectedIds)
      setIsProcessPipelineOpen(true)
    },
    [hasProcessTargets],
  )

  const headerActions = useMemo(
    () => ({
      onTranscribeClick: () => {
        const ids =
          selectedLocalRows.length > 0
            ? selectedLocalRows
                .map((r) => absolutePosixMusicFilePath(r, mediaFolderPath))
                .filter((p): p is string => p !== undefined)
            : undefined
        openTranscribe(ids && ids.length > 0 ? ids : undefined)
      },
      onTranslateClick: () => {
        if (selectedLocalRows.length > 0) {
          const ids: string[] = []
          for (const sel of selectedLocalRows) {
            const abs = absolutePosixMusicFilePath(sel, mediaFolderPath)
            const match = subtitleTranslationDialogRows.find(
              (r) => r.mediaPath === abs && r.eligible && r.path,
            )
            if (match) ids.push(match.id)
          }
          openTranslate(ids.length > 0 ? ids : undefined)
        } else {
          openTranslate(undefined)
        }
      },
      onSynthesizeClick: () => {
        if (selectedLocalRows.length > 0) {
          const ids: string[] = []
          for (const sel of selectedLocalRows) {
            const abs = absolutePosixMusicFilePath(sel, mediaFolderPath)!
            const match = synthesizeSubtitleDialogRows.find(
              (r) => r.videoPath === abs && r.eligible && r.subtitlePath,
            )
            if (match) ids.push(match.id)
          }
          openSynthesize(ids.length > 0 ? ids : undefined)
        } else {
          openSynthesize(undefined)
        }
      },
      onProcessClick: () => {
        const ids =
          selectedLocalRows.length > 0
            ? selectedLocalRows
                .map((r) => absolutePosixMusicFilePath(r, mediaFolderPath))
                .filter((p): p is string => p !== undefined)
            : undefined
        openProcess(ids && ids.length > 0 ? ids : undefined)
      },
    }),
    [
      selectedLocalRows,
      mediaFolderPath,
      openTranscribe,
      openTranslate,
      openSynthesize,
      openProcess,
      subtitleTranslationDialogRows,
      synthesizeSubtitleDialogRows,
    ],
  )

  const bindRowActions = useCallback(
    (row: LocalFileTableRowData) => ({
      onTranscribe: () => {
        const pathId = absolutePosixMusicFilePath(row, mediaFolderPath)!
        onClearSelection?.()
        openTranscribe([pathId])
      },
      onTranscribeStop: () => stopPipelineJob(row, "transcribe"),
      onTranslate: () => {
        const pathId = absolutePosixMusicFilePath(row, mediaFolderPath)
        const match = subtitleTranslationDialogRows.find(
          (r) => r.mediaPath === pathId && r.eligible && r.path,
        )
        if (!match) {
          toast.error(`Track "${row.title}" does not have a sidecar subtitle to translate.`)
          return
        }
        onClearSelection?.()
        openTranslate([match.id])
      },
      onTranslateStop: () => stopPipelineJob(row, "translate"),
      onSynthesize: () => {
        const pathId = absolutePosixMusicFilePath(row, mediaFolderPath)
        const match = synthesizeSubtitleDialogRows.find(
          (r) => r.videoPath === pathId && r.eligible && r.subtitlePath,
        )
        if (!match) {
          toast.error(`Track "${row.title}" is not eligible for subtitle synthesis.`)
          return
        }
        onClearSelection?.()
        openSynthesize([match.id])
      },
      onSynthesizeStop: () => stopPipelineJob(row, "synthesize"),
      onProcess: () => {
        const pathId = absolutePosixMusicFilePath(row, mediaFolderPath)!
        onClearSelection?.()
        openProcess([pathId])
      },
      onProcessStop: () => stopPipelineJob(row, "process"),
    }),
    [
      mediaFolderPath,
      onClearSelection,
      openTranscribe,
      openTranslate,
      openSynthesize,
      openProcess,
      stopPipelineJob,
      subtitleTranslationDialogRows,
      synthesizeSubtitleDialogRows,
    ],
  )

  return {
    availability: {
      isTranscribeAvailable,
      isTranslateAvailable,
      isSynthesizeAvailable,
      isProcessAvailable,
    },
    hasTranscribeTargets,
    hasTranslateTargets,
    hasSynthesizeTargets,
    hasProcessTargets,
    headerActions,
    getRowPipelineState,
    bindRowActions,
    stopPipelineJob,
    dialogProps: {
      transcribe: {
        isOpen: isTranscribeOpen,
        onClose: () => {
          setIsTranscribeOpen(false)
          setTranscribeDialogDefaultSelectedIds(undefined)
        },
        rows: transcribeDialogRows,
        defaultSelectedIds: transcribeDialogDefaultSelectedIds,
        folder: dialogFolder,
      },
      translate: {
        isOpen: isSubtitleTranslationOpen,
        onClose: () => {
          setIsSubtitleTranslationOpen(false)
          setSubtitleTranslationDefaultSelectedIds(undefined)
        },
        rows: subtitleTranslationDialogRows,
        defaultSelectedIds: subtitleTranslationDefaultSelectedIds,
        folder: dialogFolder,
      },
      synthesize: {
        isOpen: isSynthesizeSubtitleOpen,
        onClose: () => {
          setIsSynthesizeSubtitleOpen(false)
          setSynthesizeSubtitleDefaultSelectedIds(undefined)
        },
        rows: synthesizeSubtitleDialogRows,
        defaultSelectedIds: synthesizeSubtitleDefaultSelectedIds,
        folder: dialogFolder,
      },
      process: {
        isOpen: isProcessPipelineOpen,
        onClose: () => {
          setIsProcessPipelineOpen(false)
          setProcessPipelineDefaultSelectedIds(undefined)
        },
        rows: processPipelineRows,
        defaultSelectedIds: processPipelineDefaultSelectedIds,
        folder: dialogFolder,
      },
    },
  }
}
