import { useMemo, useCallback, useRef } from "react"
import { Path } from "@core/path"
import { toast } from "sonner"
import { useJobManager } from "@/hooks/useJobManager"
import { useTranslation } from "@/lib/i18n"

const AUTO_START_KEY = "process.autoStart"

export interface UseProcessManagerOptions {
  platformFolder: string | undefined
  onJobSucceeded?: () => void
}

export function useProcessManager({ platformFolder, onJobSucceeded }: UseProcessManagerOptions) {
  const { t } = useTranslation("components")
  const tRef = useRef(t)
  tRef.current = t

  const onSwEvent = useCallback((event: string, _jobId: string) => {
    const tr = tRef.current
    if (event === "process:started") {
      toast.info(tr("processPipelineDialog.toastStart"))
    } else if (event === "process:succeeded") {
      toast.success(tr("processPipelineDialog.toastSucceeded"))
    } else if (event === "process:failed") {
      toast.error(tr("processPipelineDialog.toastFailed"))
    }
  }, [])

  const { jobRecords, hasRunningJob, startJob, stopJob, removeJob } = useJobManager({
    jobType: "process",
    messagePrefix: "process",
    platformFolder,
    autoStartKey: AUTO_START_KEY,
    onJobSucceeded,
    onSwEvent,
  })

  const { processingPaths, pendingProcessPaths, processFailedPaths, jobIdByPath } = useMemo(() => {
    const processingPaths = new Set<string>()
    const pendingProcessPaths = new Set<string>()
    const processFailedPaths = new Set<string>()
    const jobIdByPath = new Map<string, string>()
    for (const r of jobRecords) {
      if (r.type !== "process") continue
      let mediaPath = ""
      try {
        const d = JSON.parse(r.data || "{}") as { mediaPath?: string }
        if (d.mediaPath?.trim()) mediaPath = Path.posix(d.mediaPath.trim())
      } catch {
        continue
      }
      if (!mediaPath) continue
      jobIdByPath.set(mediaPath, r.id)
      if (r.status === "running") processingPaths.add(mediaPath)
      if (r.status === "pending") pendingProcessPaths.add(mediaPath)
      if (r.status === "failed") processFailedPaths.add(mediaPath)
    }
    return { processingPaths, pendingProcessPaths, processFailedPaths, jobIdByPath }
  }, [jobRecords])

  return {
    jobRecords,
    hasRunningProcess: hasRunningJob,
    startProcess: startJob,
    stopProcess: stopJob,
    removeProcess: removeJob,
    processingPaths,
    pendingProcessPaths,
    processFailedPaths,
    jobIdByPath,
  }
}
