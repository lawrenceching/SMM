import { useCallback, useEffect, useMemo, useReducer } from "react"
import { Loader2, CheckCircle2, XCircle, Circle } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { ScrapeDialogProps } from "./types"
import { useTranslation } from "@/lib/i18n"
import { useScrapeNfoMutation } from "@/hooks/useScrapeNfoMutation"
import { useScrapePosterMutation } from "@/hooks/useScrapePosterMutation"
import { useScrapeFanartMutation } from "@/hooks/useScrapeFanartMutation"
import { useScrapeThumbnailMutation } from "@/hooks/useScrapeThumbnailMutation"
import { listFiles } from "@/api/listFiles"
import { Path } from "@core/path"
import { basename, dirname, extname } from "@/lib/path"
import type { MediaMetadata } from "@core/types"
import { imageFileExtensions } from "@/lib/utils"
import { useMediaMetadataActions } from "@/actions/mediaMetadataActions"
import { nextTraceId } from "@/lib/utils"
import { useConfig } from "@/providers/config-provider"

type TaskId = "poster" | "fanart" | "thumbnails" | "nfo"
type TaskStatus = "pending" | "running" | "completed" | "failed"

interface TaskView {
  id: TaskId
  name: string
  status: TaskStatus
}

interface TaskState {
  tasks: TaskView[]
  isRunning: boolean
}

type TaskAction =
  | { type: "INIT"; tasks: TaskView[] }
  | { type: "SET_COMPLETION"; completion: Record<TaskId, boolean> }
  | { type: "MARK_RUNNING"; id: TaskId }
  | { type: "MARK_COMPLETED"; id: TaskId }
  | { type: "MARK_FAILED"; id: TaskId }
  | { type: "START_RUN" }
  | { type: "FINISH_RUN" }

const TASK_ORDER: TaskId[] = ["poster", "fanart", "thumbnails", "nfo"]

function taskReducer(state: TaskState, action: TaskAction): TaskState {
  switch (action.type) {
    case "INIT":
      return { tasks: action.tasks, isRunning: false }
    case "SET_COMPLETION":
      return {
        ...state,
        tasks: state.tasks.map((task) => ({
          ...task,
          status: action.completion[task.id] ? "completed" : "pending",
        })),
      }
    case "MARK_RUNNING":
      return {
        ...state,
        tasks: state.tasks.map((task) =>
          task.id === action.id ? { ...task, status: "running" } : task,
        ),
      }
    case "MARK_COMPLETED":
      return {
        ...state,
        tasks: state.tasks.map((task) =>
          task.id === action.id ? { ...task, status: "completed" } : task,
        ),
      }
    case "MARK_FAILED":
      return {
        ...state,
        tasks: state.tasks.map((task) =>
          task.id === action.id ? { ...task, status: "failed" } : task,
        ),
      }
    case "START_RUN":
      return { ...state, isRunning: true }
    case "FINISH_RUN":
      return { ...state, isRunning: false }
    default:
      return state
  }
}

function areAllTasksDone(tasks: TaskView[]): boolean {
  return tasks.every((task) => task.status === "completed" || task.status === "failed")
}

async function checkTaskCompletion(mediaMetadata: MediaMetadata): Promise<Record<TaskId, boolean>> {
  const defaultCompletion: Record<TaskId, boolean> = {
    poster: false,
    fanart: false,
    thumbnails: false,
    nfo: false,
  }

  if (!mediaMetadata.mediaFolderPath) {
    return defaultCompletion
  }

  try {
    const response = await listFiles({
      path: Path.toPlatformPath(mediaMetadata.mediaFolderPath),
      onlyFiles: true,
      recursively: true,
    })

    if (!response.data?.items) {
      return defaultCompletion
    }

    const files = response.data.items.map((p) => Path.posix(p.path))
    const hasImageNamed = (prefix: "poster" | "fanart") =>
      files.some((file) => {
        const fileName = basename(file)
        if (!fileName) return false
        return (
          fileName.startsWith(`${prefix}.`) &&
          imageFileExtensions.some((ext: string) => fileName.toLowerCase().endsWith(ext.toLowerCase()))
        )
      })

    const poster = hasImageNamed("poster")
    const fanart = hasImageNamed("fanart")

    let nfo = false
    if (mediaMetadata.type === "movie-folder") {
      nfo = files.some((file) => basename(file) === "movie.nfo")
    } else {
      const tvshowNfoOk = files.some((file) => basename(file) === "tvshow.nfo")
      let episodeNfosOk = true
      for (const mediaFile of mediaMetadata.mediaFiles ?? []) {
        if (mediaFile.seasonNumber === undefined || mediaFile.episodeNumber === undefined) continue
        const videoBase = basename(mediaFile.absolutePath)
        if (!videoBase) continue
        const videoExt = extname(videoBase)
        const noExt = videoExt ? videoBase.slice(0, -videoExt.length) : videoBase
        const expectedNfo = `${noExt}.nfo`
        const videoDir = dirname(mediaFile.absolutePath)
        const found = files.some((file) => dirname(file) === videoDir && basename(file) === expectedNfo)
        if (!found) {
          episodeNfosOk = false
          break
        }
      }
      nfo = tvshowNfoOk && episodeNfosOk
    }

    let thumbnails = true
    for (const mediaFile of mediaMetadata.mediaFiles ?? []) {
      if (mediaFile.seasonNumber === undefined || mediaFile.episodeNumber === undefined) continue
      const videoBase = basename(mediaFile.absolutePath)
      if (!videoBase) {
        thumbnails = false
        break
      }
      const videoExt = extname(videoBase)
      const noExt = videoBase.replace(videoExt, "")
      const videoDir = dirname(mediaFile.absolutePath)
      const filesInSameDir = files.filter((file) => dirname(file) === videoDir)
      const hasThumb = filesInSameDir.some((file) => {
        const fileName = basename(file)
        if (!fileName) return false
        return (
          fileName.startsWith(`${noExt}.`) &&
          imageFileExtensions.some((ext: string) => fileName.toLowerCase().endsWith(ext.toLowerCase()))
        )
      })
      if (!hasThumb) {
        thumbnails = false
        break
      }
    }

    return { poster, fanart, thumbnails, nfo }
  } catch {
    return defaultCompletion
  }
}

function TaskItem({ task }: { task: TaskView }) {
  const { t } = useTranslation("dialogs")

  const icon =
    task.status === "running" ? (
      <Loader2 className="h-4 w-4 animate-spin text-primary" />
    ) : task.status === "completed" ? (
      <CheckCircle2 className="h-4 w-4 text-green-500" />
    ) : task.status === "failed" ? (
      <XCircle className="h-4 w-4 text-destructive" />
    ) : (
      <Circle className="h-4 w-4 text-muted-foreground" />
    )

  const text =
    task.status === "running"
      ? t("scrape.status.running")
      : task.status === "completed"
        ? t("scrape.status.completed")
        : task.status === "failed"
          ? t("scrape.status.failed")
          : t("scrape.status.pending")

  return (
    <TableRow data-testid={`scrape-dialog-task-row-${task.id}`}>
      <TableCell className="py-2 px-2">
        <span className="text-sm">{task.name}</span>
      </TableCell>
      <TableCell className="py-2 px-2">
        <div className="flex items-center gap-2" data-testid={`scrape-dialog-task-status-${task.id}`}>
          {icon}
          <span className="text-xs text-muted-foreground">{text}</span>
        </div>
      </TableCell>
    </TableRow>
  )
}

export function ScrapeDialogV2({ isOpen, onClose, mediaMetadata }: ScrapeDialogProps) {
  const { t } = useTranslation(["dialogs", "common"])
  const defaultTitle = t("scrape.defaultTitle")
  const defaultDescription = t("scrape.defaultDescription")
  const { mutateAsync: scrapePoster } = useScrapePosterMutation()
  const { mutateAsync: scrapeFanart } = useScrapeFanartMutation()
  const { mutateAsync: scrapeThumbnail } = useScrapeThumbnailMutation()
  const { mutateAsync: scrapeNfo } = useScrapeNfoMutation()
  const { userConfig } = useConfig()
  const { refreshMediaMetadata } = useMediaMetadataActions()
  const [state, dispatch] = useReducer(taskReducer, { tasks: [], isRunning: false })

  const executeTask = useCallback(
    async (id: TaskId, currentMediaMetadata: MediaMetadata) => {
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

    const tasks: TaskView[] = [
      { id: "poster", name: t("scrape.tasks.poster", { ns: "dialogs" }), status: "pending" },
      { id: "fanart", name: t("scrape.tasks.fanart", { ns: "dialogs" }), status: "pending" },
      { id: "thumbnails", name: t("scrape.tasks.thumbnails", { ns: "dialogs" }), status: "pending" },
      { id: "nfo", name: t("scrape.tasks.nfo", { ns: "dialogs" }), status: "pending" },
    ]
    dispatch({ type: "INIT", tasks })

    let cancelled = false
    checkTaskCompletion(mediaMetadata)
      .then((completion) => {
        if (cancelled) return
        dispatch({ type: "SET_COMPLETION", completion })
      })
      .catch((error) => {
        console.error("[ScrapeDialogV2] initialize completion failed:", error)
      })

    return () => {
      cancelled = true
    }
  }, [isOpen, mediaMetadata, t])

  const allTasksDone = useMemo(() => areAllTasksDone(state.tasks), [state.tasks])
  const canClose = allTasksDone && !state.isRunning
  const showButtons = mediaMetadata !== undefined

  const handleClose = useCallback(() => {
    if (!canClose) return
    onClose()
  }, [canClose, onClose])

  const handleStart = useCallback(async () => {
    if (!mediaMetadata) return
    if (allTasksDone) {
      onClose()
      return
    }
    if (state.isRunning) return

    dispatch({ type: "START_RUN" })
    const traceId = `ScrapeDialogV2-handleStart-${nextTraceId()}`
    try {
      const taskStatusMap = new Map(state.tasks.map((task) => [task.id, task.status]))
      for (const id of TASK_ORDER) {
        const status = taskStatusMap.get(id)
        if (status === "completed" || status === "failed") continue
        dispatch({ type: "MARK_RUNNING", id })
        try {
          await executeTask(id, mediaMetadata)
          dispatch({ type: "MARK_COMPLETED", id })
        } catch (error) {
          dispatch({ type: "MARK_FAILED", id })
          console.error(`[ScrapeDialogV2] task ${id} failed:`, error)
        }
      }
      if (mediaMetadata.mediaFolderPath) {
        await refreshMediaMetadata(mediaMetadata.mediaFolderPath, { traceId })
      }
    } catch (error) {
      console.error("[ScrapeDialogV2] run failed:", error)
    } finally {
      dispatch({ type: "FINISH_RUN" })
    }
  }, [mediaMetadata, allTasksDone, state.isRunning, state.tasks, executeTask, refreshMediaMetadata, onClose])

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open && canClose) {
          onClose()
        }
      }}
    >
      <DialogContent showCloseButton={canClose} className="max-w-2xl" data-testid="scrape-dialog">
        <DialogHeader>
          <DialogTitle>{defaultTitle}</DialogTitle>
          <DialogDescription>{defaultDescription}</DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[400px] w-full">
          {state.tasks.length === 0 ? (
            <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
              {t("scrape.noTasks")}
            </div>
          ) : (
            <Table data-testid="scrape-dialog-table">
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="py-2 px-2">{t("scrape.columns.file")}</TableHead>
                  <TableHead className="py-2 px-2">{t("scrape.columns.status")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {state.tasks.map((task) => (
                  <TaskItem key={task.id} task={task} />
                ))}
              </TableBody>
            </Table>
          )}
        </ScrollArea>
        {showButtons && (
          <div className="flex justify-end gap-2 pt-4">
            <Button
              variant="outline"
              onClick={handleClose}
              data-testid="scrape-dialog-cancel"
              disabled={!canClose}
            >
              {t("cancel", { ns: "common" })}
            </Button>
            <Button
              onClick={handleStart}
              disabled={allTasksDone || state.isRunning}
              data-testid="scrape-dialog-start"
            >
              {allTasksDone ? t("scrape.done") : t("scrape.start")}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

export { taskReducer, areAllTasksDone, checkTaskCompletion }

