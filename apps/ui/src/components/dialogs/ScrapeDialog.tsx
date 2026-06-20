import { useCallback, useEffect, useMemo, useReducer } from "react"
import type { ScrapeDialogProps } from "./types"
import { UIScrapeDialog } from "./UIScrapeDialog"
import { useScrapeNfoMutation } from "@/hooks/useScrapeNfoMutation"
import { useScrapePosterMutation } from "@/hooks/useScrapePosterMutation"
import { useScrapeFanartMutation } from "@/hooks/useScrapeFanartMutation"
import { useScrapeThumbnailMutation } from "@/hooks/useScrapeThumbnailMutation"
import { useFetchMediaMetadataMutation } from "@/hooks/mediaMetadata/useFetchMediaMetadataMutation"
import { useConfig } from "@/hooks/userConfig"
import { nextTraceId } from "@/lib/utils"
import type { MediaMetadata } from "@core/types"
import {
  areAllTasksDone,
  checkTaskCompletion,
  createInitialScrapeTasksForMedia,
  INITIAL_SCRAPE_TASK_STATE,
  taskReducer,
  type ScrapeTaskId,
} from "@/lib/scrapeDialog"

export function ScrapeDialog({ isOpen, onClose, mediaMetadata }: ScrapeDialogProps) {
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

  const handleClose = useCallback(() => {
    if (cancelDisabled) return
    onClose()
  }, [cancelDisabled, onClose])

  const handleStart = useCallback(async () => {
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
          const reason = error instanceof Error ? error.message : String(error)
          dispatch({ type: "MARK_FAILED", id, reason })
          console.error(`[ScrapeDialog] task ${id} failed:`, error)
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

  return (
    <UIScrapeDialog
      isOpen={isOpen}
      onClose={onClose}
      tasks={state.tasks}
      isRunning={state.isRunning}
      allTasksDone={allTasksDone}
      showButtons={showButtons}
      cancelDisabled={cancelDisabled}
      canDismissIncidentally={canDismissIncidentally}
      onCancel={handleClose}
      onStart={handleStart}
    />
  )
}
