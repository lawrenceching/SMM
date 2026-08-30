import { useCallback, useEffect, useMemo, useReducer } from "react"
import { useScrapeNfoMutation } from "@/hooks/useScrapeNfoMutation"
import { useScrapePosterMutation } from "@/hooks/useScrapePosterMutation"
import { useScrapeFanartMutation } from "@/hooks/useScrapeFanartMutation"
import { useScrapeThumbnailMutation } from "@/hooks/useScrapeThumbnailMutation"
import { useFetchMediaMetadataMutation } from "@/hooks/mediaMetadata/useFetchMediaMetadataMutation"
import { useConfig } from "@/hooks/userConfig"
import { nextTraceId } from "@/lib/utils"
import type { MediaMetadata } from "@smm/types"
import {
  areAllTasksDone,
  checkTaskCompletion,
  createInitialScrapeTasksForMedia,
  INITIAL_SCRAPE_TASK_STATE,
  taskReducer,
  type ScrapeTaskId,
  type ScrapeTaskStatus,
  type ScrapeTaskView,
} from "@/lib/scrapeDialog"
import { normalizeScrapeTaskError } from "@/lib/scrapeError"
import { isSmmV3Enabled } from "@/lib/localStorages"
import { scrapeFolderViaCore } from "@/api/scrapeV3"
import { getJobViaCore, type ScrapeJob, type ScrapeTaskRuntimeStatus } from "@/api/getJob"

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

const POLL_INTERVAL_MS = 1000

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function mapCoreTaskStatus(status: ScrapeTaskRuntimeStatus): ScrapeTaskStatus {
  if (status === "skipped") return "completed"
  if (status === "pending" || status === "running" || status === "completed" || status === "failed") {
    return status
  }
  return "pending"
}

function jobTasksToAction(
  job: ScrapeJob,
): Partial<Record<ScrapeTaskId, { status: ScrapeTaskStatus; failedReason?: string }>> {
  const result: Partial<Record<ScrapeTaskId, { status: ScrapeTaskStatus; failedReason?: string }>> =
    {}
  for (const id of Object.keys(job.tasks) as ScrapeTaskId[]) {
    const task = job.tasks[id]
    if (!task) continue
    result[id] = {
      status: mapCoreTaskStatus(task.status),
      failedReason: task.error,
    }
  }
  return result
}

export function useScrapeDialog({
  isOpen,
  onClose,
  mediaMetadata,
}: UseScrapeDialogInput): UseScrapeDialogResult {
  const { mutateAsync: scrapePoster } = useScrapePosterMutation()
  const { mutateAsync: scrapeFanart } = useScrapeFanartMutation()
  const { mutateAsync: scrapeThumbnail } = useScrapeThumbnailMutation()
  const { mutateAsync: scrapeNfo } = useScrapeNfoMutation()
  const { userConfig } = useConfig()
  const { mutateAsync: refreshMediaMetadata } = useFetchMediaMetadataMutation()
  const [state, dispatch] = useReducer(taskReducer, INITIAL_SCRAPE_TASK_STATE)

  const executeTask = useCallback(
    async (id: ScrapeTaskId, currentMediaMetadata: MediaMetadata) => {
      if (id === "poster") {
        await scrapePoster({
          mediaMetadata: currentMediaMetadata,
          language: userConfig.preferMediaLanguage,
        })
        return
      }
      if (id === "fanart") {
        await scrapeFanart({
          mediaMetadata: currentMediaMetadata,
          language: userConfig.preferMediaLanguage,
        })
        return
      }
      if (id === "thumbnails") {
        await scrapeThumbnail({ mediaMetadata: currentMediaMetadata })
        return
      }
      await scrapeNfo({ mediaMetadata: currentMediaMetadata })
    },
    [scrapePoster, scrapeFanart, userConfig.preferMediaLanguage, scrapeThumbnail, scrapeNfo],
  )

  useEffect(() => {
    if (!isOpen || !mediaMetadata) return

    dispatch({ type: "INIT", tasks: createInitialScrapeTasksForMedia(mediaMetadata) })

    let cancelled = false
    checkTaskCompletion(mediaMetadata)
      .then((completion) => {
        if (cancelled) return
        dispatch({ type: "SET_COMPLETION", completion })
      })
      .catch((error) => {
        console.error("[ScrapeDialog] initialize completion failed:", error)
      })

    return () => {
      cancelled = true
    }
  }, [isOpen, mediaMetadata])

  const allTasksDone = useMemo(() => areAllTasksDone(state.tasks), [state.tasks])
  const canDismissIncidentally = allTasksDone && !state.isRunning
  const cancelDisabled = state.isRunning
  const showButtons = mediaMetadata !== undefined

  const handleCancel = useCallback(() => {
    if (cancelDisabled) return
    onClose()
  }, [cancelDisabled, onClose])

  const handleStartLegacy = useCallback(async () => {
    if (!mediaMetadata) return
    if (allTasksDone) {
      onClose()
      return
    }
    if (state.isRunning) return

    dispatch({ type: "START_RUN" })
    const traceId = `ScrapeDialog-handleStart-${nextTraceId()}`
    try {
      const taskStatusMap = new Map(state.tasks.map((task) => [task.id, task.status]))
      for (const task of state.tasks) {
        const id = task.id
        const status = taskStatusMap.get(id)
        if (status === "completed" || status === "failed") continue
        dispatch({ type: "MARK_RUNNING", id })
        try {
          await executeTask(id, mediaMetadata)
          dispatch({ type: "MARK_COMPLETED", id })
        } catch (error) {
          const { messageKey, debugDetail } = normalizeScrapeTaskError(error)
          dispatch({
            type: "MARK_FAILED",
            id,
            reason: debugDetail.trim() ? messageKey : undefined,
          })
          console.error(`[ScrapeDialog] task ${id} failed:`, debugDetail, error)
        }
      }
      if (mediaMetadata.mediaFolderPath) {
        await refreshMediaMetadata({ path: mediaMetadata.mediaFolderPath, traceId })
      }
    } catch (error) {
      console.error("[ScrapeDialog] run failed:", error)
    } finally {
      dispatch({ type: "FINISH_RUN" })
    }
  }, [
    mediaMetadata,
    allTasksDone,
    state.isRunning,
    state.tasks,
    executeTask,
    refreshMediaMetadata,
    onClose,
  ])

  const handleStartV3 = useCallback(async () => {
    if (!mediaMetadata?.mediaFolderPath) return
    if (allTasksDone) {
      onClose()
      return
    }
    if (state.isRunning) return

    dispatch({ type: "START_RUN" })
    const traceId = `ScrapeDialog-handleStartV3-${nextTraceId()}`
    try {
      const jobId = await scrapeFolderViaCore({
        path: mediaMetadata.mediaFolderPath,
        language: userConfig.preferMediaLanguage,
      })

      for (;;) {
        const job = await getJobViaCore(jobId)
        if (job.kind !== "scrape") {
          throw new Error(`Error Reason: unexpected job kind: ${job.kind}`)
        }
        dispatch({ type: "APPLY_JOB_TASKS", tasks: jobTasksToAction(job) })
        if (
          job.status === "succeeded" ||
          job.status === "failed" ||
          job.status === "aborted"
        ) {
          break
        }
        await sleep(POLL_INTERVAL_MS)
      }

      await refreshMediaMetadata({ path: mediaMetadata.mediaFolderPath, traceId })
    } catch (error) {
      const { messageKey, debugDetail } = normalizeScrapeTaskError(error)
      console.error("[ScrapeDialog] v3 run failed:", debugDetail, error)
      dispatch({
        type: "APPLY_JOB_TASKS",
        tasks: Object.fromEntries(
          state.tasks
            .filter((task) => task.status === "pending" || task.status === "running")
            .map((task) => [
              task.id,
              {
                status: "failed" as const,
                failedReason: debugDetail.trim() ? messageKey : undefined,
              },
            ]),
        ),
      })
    } finally {
      dispatch({ type: "FINISH_RUN" })
    }
  }, [
    mediaMetadata,
    allTasksDone,
    state.isRunning,
    state.tasks,
    userConfig.preferMediaLanguage,
    refreshMediaMetadata,
    onClose,
  ])

  const handleStart = useCallback(async () => {
    if (isSmmV3Enabled()) {
      await handleStartV3()
      return
    }
    await handleStartLegacy()
  }, [handleStartV3, handleStartLegacy])

  return {
    tasks: state.tasks,
    isRunning: state.isRunning,
    allTasksDone,
    showButtons,
    cancelDisabled,
    canDismissIncidentally,
    handleCancel,
    handleStart,
  }
}
