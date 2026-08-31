import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useFetchMediaMetadataMutation } from "@/hooks/mediaMetadata/useFetchMediaMetadataMutation"
import { useScrapeMutation } from "@/hooks/useScrapeMutation"
import { isJobTerminalStatus, useJobQuery } from "@/hooks/useJobQuery"
import { useScrapeTaskCompletionQuery } from "@/hooks/useScrapeTaskCompletionQuery"
import { useConfig } from "@/hooks/userConfig"
import { nextTraceId } from "@/lib/utils"
import type { MediaMetadata } from "@smm/types"
import { areAllTasksDone, deriveScrapeTasks, type ScrapeTaskView } from "@/lib/scrapeDialog"

export interface UseScrapeDialogInput {
  isOpen: boolean
  onClose: () => void
  mediaMetadata?: MediaMetadata
}

export interface UseScrapeDialogResult {
  tasks: ScrapeTaskView[]
  isRunning: boolean
  allTasksDone: boolean
  showButtons: boolean
  cancelDisabled: boolean
  canDismissIncidentally: boolean
  handleCancel: () => void
  handleStart: () => Promise<void>
}

export function useScrapeDialog({
  isOpen,
  onClose,
  mediaMetadata,
}: UseScrapeDialogInput): UseScrapeDialogResult {
  const { userConfig } = useConfig()
  const {
    mutateAsync: refreshMediaMetadata,
    isPending: isRefreshingMetadata,
  } = useFetchMediaMetadataMutation()
  const {
    mutateAsync: scrapeFolder,
    isPending: isStartingScrape,
    error: scrapeMutationError,
    reset: resetScrapeMutation,
  } = useScrapeMutation()

  const [jobId, setJobId] = useState<string | null>(null)
  const [overlayError, setOverlayError] = useState<unknown>(null)
  const runTraceIdRef = useRef<string | null>(null)
  const refreshedJobIdRef = useRef<string | null>(null)

  const { data: completion } = useScrapeTaskCompletionQuery(mediaMetadata, isOpen)
  const { data: job } = useJobQuery({
    jobId,
    enabled: !!jobId,
  })

  const scrapeJob = job?.kind === "scrape" ? job : null
  const startError = overlayError ?? scrapeMutationError

  const tasks = useMemo(
    () =>
      deriveScrapeTasks({
        mediaMetadata,
        completion,
        scrapeJob,
        startError: scrapeJob ? null : startError,
      }),
    [mediaMetadata, completion, scrapeJob, startError],
  )

  const jobInFlight =
    !!jobId &&
    (!job || (job.kind === "scrape" && !isJobTerminalStatus(job.status)))

  const isRunning = isStartingScrape || jobInFlight || isRefreshingMetadata
  const allTasksDone = useMemo(() => areAllTasksDone(tasks), [tasks])
  const canDismissIncidentally = allTasksDone && !isRunning
  const cancelDisabled = isRunning
  const showButtons = mediaMetadata !== undefined

  useEffect(() => {
    if (!isOpen) return
    setJobId(null)
    setOverlayError(null)
    resetScrapeMutation()
    runTraceIdRef.current = null
    refreshedJobIdRef.current = null
  }, [isOpen, mediaMetadata?.mediaFolderPath, resetScrapeMutation])

  useEffect(() => {
    if (!jobId || !job) return
    if (job.kind === "scrape") return
    setOverlayError(new Error(`Error Reason: unexpected job kind: ${job.kind}`))
    setJobId(null)
  }, [job, jobId])

  useEffect(() => {
    if (!jobId || !scrapeJob) return
    if (!isJobTerminalStatus(scrapeJob.status)) return
    if (refreshedJobIdRef.current === jobId) return
    refreshedJobIdRef.current = jobId

    const path = mediaMetadata?.mediaFolderPath
    const traceId = runTraceIdRef.current ?? `ScrapeDialog-handleStart-${nextTraceId()}`

    void (async () => {
      try {
        if (path) {
          await refreshMediaMetadata({ path, traceId })
        }
      } catch (error) {
        console.error("[ScrapeDialog] refresh media metadata failed:", error)
      } finally {
        runTraceIdRef.current = null
      }
    })()
  }, [jobId, scrapeJob, mediaMetadata?.mediaFolderPath, refreshMediaMetadata])

  const handleCancel = useCallback(() => {
    if (cancelDisabled) return
    onClose()
  }, [cancelDisabled, onClose])

  const handleStart = useCallback(async () => {
    if (!mediaMetadata?.mediaFolderPath) return
    if (allTasksDone) {
      onClose()
      return
    }
    if (isRunning) return

    setOverlayError(null)
    resetScrapeMutation()
    refreshedJobIdRef.current = null
    const traceId = `ScrapeDialog-handleStart-${nextTraceId()}`
    runTraceIdRef.current = traceId
    try {
      const id = await scrapeFolder({
        path: mediaMetadata.mediaFolderPath,
        language: userConfig.preferMediaLanguage,
      })
      setJobId(id)
    } catch (error) {
      console.error("[ScrapeDialog] run failed:", error)
      runTraceIdRef.current = null
    }
  }, [
    mediaMetadata,
    allTasksDone,
    isRunning,
    userConfig.preferMediaLanguage,
    scrapeFolder,
    resetScrapeMutation,
    onClose,
  ])

  return {
    tasks,
    isRunning,
    allTasksDone,
    showButtons,
    cancelDisabled,
    canDismissIncidentally,
    handleCancel,
    handleStart,
  }
}
