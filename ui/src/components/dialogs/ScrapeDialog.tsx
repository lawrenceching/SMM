import { useMemo } from "react"
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
import { cn } from "@/lib/utils"
import type { ScrapeDialogProps, Task } from "./types"

function TaskItem({ task, level = 0 }: { task: Task; level?: number }) {
  const getStatusIcon = () => {
    switch (task.status) {
      case "running":
        return <Loader2 className="h-4 w-4 animate-spin text-primary" />
      case "completed":
        return <CheckCircle2 className="h-4 w-4 text-green-500" />
      case "failed":
        return <XCircle className="h-4 w-4 text-destructive" />
      case "pending":
      default:
        return <Circle className="h-4 w-4 text-muted-foreground" />
    }
  }

  const getStatusText = () => {
    switch (task.status) {
      case "running":
        return "Running"
      case "completed":
        return "Completed"
      case "failed":
        return "Failed"
      case "pending":
      default:
        return "Pending"
    }
  }

  return (
    <div className="flex flex-col">
      <div
        className={cn(
          "flex items-center gap-3 py-2",
          level > 0 && "ml-6 border-l-2 border-muted pl-4"
        )}
      >
        {getStatusIcon()}
        <div className="flex-1">
          <span className="text-sm font-medium">{task.name}</span>
          <span className="ml-2 text-xs text-muted-foreground">
            ({getStatusText()})
          </span>
        </div>
      </div>
      {task.subTasks && task.subTasks.length > 0 && (
        <div className="ml-6 space-y-1">
          {task.subTasks.map((subTask, index) => (
            <TaskItem key={index} task={subTask} level={level + 1} />
          ))}
        </div>
      )}
    </div>
  )
}

function areAllTasksDone(tasks: Task[]): boolean {
  return tasks.every((task) => {
    const isDone = task.status === "completed" || task.status === "failed"
    const subTasksDone =
      !task.subTasks || task.subTasks.length === 0
        ? true
        : areAllTasksDone(task.subTasks)
    return isDone && subTasksDone
  })
}

function areAllTasksPending(tasks: Task[]): boolean {
  return tasks.every((task) => {
    const isPending = task.status === "pending"
    const subTasksPending =
      !task.subTasks || task.subTasks.length === 0
        ? true
        : areAllTasksPending(task.subTasks)
    return isPending && subTasksPending
  })
}

export function ScrapeDialog({
  isOpen,
  onClose,
  tasks,
  title = "Task Progress",
  description = "Current task execution status",
  onStart,
}: ScrapeDialogProps) {
  // Add fanart task to the tasks list
  const allTasks = useMemo(() => {
    const fanartTask: Task = {
      name: "fanart",
      status: "pending",
    }
    return [fanartTask, ...tasks]
  }, [tasks])

  const allTasksDone = useMemo(() => areAllTasksDone(allTasks), [allTasks])
  const allTasksPending = useMemo(() => areAllTasksPending(allTasks), [allTasks])
  const canClose = allTasksDone
  const showStartCancel = allTasksPending && onStart !== undefined

  const handleClose = () => {
    if (canClose || showStartCancel) {
      onClose()
    }
  }

  const handleStart = () => {
    if (onStart) {
      onStart()
    }
  }

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open && (canClose || showStartCancel)) {
          handleClose()
        }
      }}
    >
      <DialogContent
        showCloseButton={canClose || showStartCancel}
        className="max-w-2xl"
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[400px] w-full">
          <div className="space-y-1 py-4">
            {allTasks.length === 0 ? (
              <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
                No tasks
              </div>
            ) : (
              allTasks.map((task, index) => (
                <TaskItem key={index} task={task} level={0} />
              ))
            )}
          </div>
        </ScrollArea>
        {showStartCancel && (
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button onClick={handleStart}>
              Start
            </Button>
          </div>
        )}
        {canClose && !showStartCancel && (
          <div className="flex justify-end gap-2 pt-4">
            <Button onClick={handleClose}>Close</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
