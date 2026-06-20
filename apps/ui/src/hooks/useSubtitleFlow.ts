import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"
import type {
  ProcessPipelineDialogRow,
  SubtitleTranslationDialogRow,
  SynthesizeSubtitleDialogRow,
  TranscribeDialogRow,
} from "@/components/dialogs/types"
import { useFeatures } from "@/hooks/useFeatures"
import { useJobs } from "@/hooks/useJobOrchestrator"
import { useVideoCaptionerStatus } from "@/hooks/useVideoCaptionerStatus"
import { processPipelineDialogRowsFromMediaFiles } from "@/lib/processPipelineDialogRows"
import { subtitleTranslationDialogRowsFromMediaFiles } from "@/lib/subtitleTranslationDialogRows"
import { synthesizeSubtitleDialogRowsFromMediaFiles } from "@/lib/synthesizeSubtitleDialogRows"
import { transcribeDialogRowsFromMediaFiles } from "@/lib/transcribeDialogRows"
import type { UIMediaFolderStatus } from "@/types/UIMediaFolder"
import type { MediaMetadata } from "@core/types"
import { Path } from "@core/path"

export interface UseSubtitleFlowOptions {
  mediaMetadata: MediaMetadata | undefined
  uiStatus: UIMediaFolderStatus | undefined
  onRefreshMediaMetadata: (mediaFolderPath: string) => void | Promise<void>
}

interface SubtitleDialogSlice<TRow> {
  isOpen: boolean
  onClose: () => void
  rows: TRow[]
  folder: string | undefined
}

function resolveOkMediaMetadata(
  mediaMetadata: MediaMetadata | undefined,
  uiStatus: UIMediaFolderStatus | undefined,
): MediaMetadata | undefined {
  if (!mediaMetadata || uiStatus !== "ok") {
    return undefined
  }
  return mediaMetadata
}

function mediaMetadataForTranscribeRows(
  mediaMetadata: MediaMetadata | undefined,
): MediaMetadata | undefined {
  return mediaMetadata
}

export function useSubtitleFlow({
  mediaMetadata,
  uiStatus,
  onRefreshMediaMetadata,
}: UseSubtitleFlowOptions) {
  const {
    isTranscribeEnabled,
    isTencentAsrTranscribeEnabled,
    isSubtitleFeaturesEnabled,
  } = useFeatures()
  const { isAvailable: isVideoCaptionerReady } = useVideoCaptionerStatus()

  const [isTranscribeOpen, setIsTranscribeOpen] = useState(false)
  const [isSubtitleTranslationOpen, setIsSubtitleTranslationOpen] = useState(false)
  const [isSynthesizeSubtitleOpen, setIsSynthesizeSubtitleOpen] = useState(false)
  const [isProcessPipelineOpen, setIsProcessPipelineOpen] = useState(false)

  const okMediaMetadata = useMemo(
    () => resolveOkMediaMetadata(mediaMetadata, uiStatus),
    [mediaMetadata, uiStatus],
  )

  const transcribeDialogRows = useMemo(
    () => transcribeDialogRowsFromMediaFiles(mediaMetadataForTranscribeRows(mediaMetadata)),
    [mediaMetadata],
  )
  const hasTranscribeTargets = transcribeDialogRows.length > 0

  const subtitleTranslationDialogRows = useMemo(
    () => subtitleTranslationDialogRowsFromMediaFiles(okMediaMetadata),
    [okMediaMetadata],
  )
  const hasTranslateTargets = subtitleTranslationDialogRows.some((r) => r.eligible)

  const synthesizeSubtitleDialogRows = useMemo(
    () => synthesizeSubtitleDialogRowsFromMediaFiles(okMediaMetadata),
    [okMediaMetadata],
  )
  const hasSynthesizeTargets = synthesizeSubtitleDialogRows.some((r) => r.eligible)

  const processPipelineRows = useMemo(
    () => processPipelineDialogRowsFromMediaFiles(okMediaMetadata),
    [okMediaMetadata],
  )
  const hasProcessTargets = processPipelineRows.length > 0

  const isTranscribeAvailable =
    isSubtitleFeaturesEnabled &&
    isTranscribeEnabled &&
    (isVideoCaptionerReady || isTencentAsrTranscribeEnabled)
  const isTranslateAvailable = isSubtitleFeaturesEnabled && isVideoCaptionerReady
  const isSynthesizeAvailable = isSubtitleFeaturesEnabled && isVideoCaptionerReady
  const isProcessAvailable =
    isSubtitleFeaturesEnabled && isTranscribeEnabled && isVideoCaptionerReady

  const folder = mediaMetadata?.mediaFolderPath
    ? Path.toPlatformPath(mediaMetadata.mediaFolderPath)
    : undefined

  const allJobRecords = useJobs()
  const runningJobIdsRef = useRef(new Set<string>())
  const onRefreshMediaMetadataRef = useRef(onRefreshMediaMetadata)
  onRefreshMediaMetadataRef.current = onRefreshMediaMetadata
  const mediaFolderPathRef = useRef(mediaMetadata?.mediaFolderPath)
  mediaFolderPathRef.current = mediaMetadata?.mediaFolderPath

  useEffect(() => {
    const mfp = mediaFolderPathRef.current
    if (!mfp) {
      runningJobIdsRef.current = new Set()
      return
    }
    const platformFolder = Path.toPlatformPath(mfp)
    const hadCompletion = allJobRecords.some(
      (r) =>
        r.folder === platformFolder &&
        (r.status === "succeeded" || r.status === "failed") &&
        runningJobIdsRef.current.has(r.id),
    )
    if (hadCompletion) void onRefreshMediaMetadataRef.current(mfp)
    runningJobIdsRef.current = new Set(
      allJobRecords
        .filter((r) => r.folder === platformFolder && r.status === "running")
        .map((r) => r.id),
    )
  }, [allJobRecords])

  const onTranscribeClick = useCallback(() => {
    setIsTranscribeOpen(true)
  }, [])

  const onTranslateClick = useCallback(() => {
    if (!hasTranslateTargets) {
      toast.error("No subtitle files available to translate.")
      return
    }
    setIsSubtitleTranslationOpen(true)
  }, [hasTranslateTargets])

  const onSynthesizeClick = useCallback(() => {
    if (!hasSynthesizeTargets) {
      toast.error("No video and subtitle pairs available to synthesize.")
      return
    }
    setIsSynthesizeSubtitleOpen(true)
  }, [hasSynthesizeTargets])

  const onProcessClick = useCallback(() => {
    if (!hasProcessTargets) {
      toast.error("No media files available for the pipeline.")
      return
    }
    setIsProcessPipelineOpen(true)
  }, [hasProcessTargets])

  const closeTranscribe = useCallback(() => setIsTranscribeOpen(false), [])
  const closeTranslate = useCallback(() => setIsSubtitleTranslationOpen(false), [])
  const closeSynthesize = useCallback(() => setIsSynthesizeSubtitleOpen(false), [])
  const closePipeline = useCallback(() => setIsProcessPipelineOpen(false), [])

  const dialogs = useMemo(
    () => ({
      transcribe: {
        isOpen: isTranscribeOpen,
        onClose: closeTranscribe,
        rows: transcribeDialogRows,
        folder,
      } satisfies SubtitleDialogSlice<TranscribeDialogRow>,
      translate: {
        isOpen: isSubtitleTranslationOpen,
        onClose: closeTranslate,
        rows: subtitleTranslationDialogRows,
        folder,
      } satisfies SubtitleDialogSlice<SubtitleTranslationDialogRow>,
      synthesize: {
        isOpen: isSynthesizeSubtitleOpen,
        onClose: closeSynthesize,
        rows: synthesizeSubtitleDialogRows,
        folder,
      } satisfies SubtitleDialogSlice<SynthesizeSubtitleDialogRow>,
      pipeline: {
        isOpen: isProcessPipelineOpen,
        onClose: closePipeline,
        rows: processPipelineRows,
        folder,
      } satisfies SubtitleDialogSlice<ProcessPipelineDialogRow>,
    }),
    [
      isTranscribeOpen,
      isSubtitleTranslationOpen,
      isSynthesizeSubtitleOpen,
      isProcessPipelineOpen,
      closeTranscribe,
      closeTranslate,
      closeSynthesize,
      closePipeline,
      transcribeDialogRows,
      subtitleTranslationDialogRows,
      synthesizeSubtitleDialogRows,
      processPipelineRows,
      folder,
    ],
  )

  return {
    showSubtitleMenu: isSubtitleFeaturesEnabled,
    header: {
      isTranscribeAvailable,
      hasTranscribeTargets,
      isTranslateAvailable,
      hasTranslateTargets,
      isSynthesizeAvailable,
      hasSynthesizeTargets,
      isProcessAvailable,
      hasProcessTargets,
      onTranscribeClick,
      onTranslateClick,
      onSynthesizeClick,
      onProcessClick,
    },
    dialogs,
  }
}
