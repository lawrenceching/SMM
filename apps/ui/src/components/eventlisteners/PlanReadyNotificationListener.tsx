import { useRef } from "react"
import { useMount, useUnmount } from "react-use"
import { RecognizeMediaFilePlanReady, RenameFilesPlanReady } from "@smm/types/event-types"
import { showPlanReadyNotification } from "@/lib/planReadyNotification"

function readTaskId(event: Event): string | undefined {
  const detail = (event as CustomEvent<{ taskId?: unknown }>).detail
  return typeof detail?.taskId === "string" && detail.taskId.length > 0
    ? detail.taskId
    : undefined
}

/**
 * Raises a system notification when a pending rename/recognize plan is ready
 * and the SMM window/tab is in the background. Additive only — existing
 * plans-query invalidation listeners are unchanged.
 */
export function PlanReadyNotificationListener() {
  const renameListener = useRef<((event: Event) => void) | null>(null)
  const recognizeListener = useRef<((event: Event) => void) | null>(null)

  useMount(() => {
    renameListener.current = (event: Event) => {
      const taskId = readTaskId(event)
      if (taskId) {
        showPlanReadyNotification(taskId)
      }
    }
    recognizeListener.current = (event: Event) => {
      const taskId = readTaskId(event)
      if (taskId) {
        showPlanReadyNotification(taskId)
      }
    }

    document.addEventListener(
      "socket.io_" + RenameFilesPlanReady.event,
      renameListener.current,
    )
    document.addEventListener(
      "socket.io_" + RecognizeMediaFilePlanReady.event,
      recognizeListener.current,
    )
  })

  useUnmount(() => {
    if (renameListener.current) {
      document.removeEventListener(
        "socket.io_" + RenameFilesPlanReady.event,
        renameListener.current,
      )
    }
    if (recognizeListener.current) {
      document.removeEventListener(
        "socket.io_" + RecognizeMediaFilePlanReady.event,
        recognizeListener.current,
      )
    }
  })

  return <></>
}
