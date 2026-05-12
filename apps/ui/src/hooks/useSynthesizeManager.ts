import { useMemo, useCallback, useRef } from "react"
import { Path } from "@core/path"
import { toast } from "sonner"
import { useJobManager } from "@/hooks/useJobManager"
import { useTranslation } from "@/lib/i18n"

const AUTO_START_KEY = "synthesize.autoStart"

export interface UseSynthesizeManagerOptions {
  platformFolder: string | undefined
  onJobSucceeded?: () => void
}

export function useSynthesizeManager({ platformFolder, onJobSucceeded }: UseSynthesizeManagerOptions) {
  const { t } = useTranslation("components")
  const tRef = useRef(t)
  tRef.current = t

  const onSwEvent = useCallback((event: string, _jobId: string) => {
    const tr = tRef.current
    if (event === "synthesize:started") {
      toast.info(tr("synthesizeSubtitleDialog.toastStart"))
    } else if (event === "synthesize:succeeded") {
      toast.success(tr("synthesizeSubtitleDialog.toastSucceeded"))
    } else if (event === "synthesize:failed") {
      toast.error(tr("synthesizeSubtitleDialog.toastFailed"))
    }
  }, [])

  const { jobRecords, hasRunningJob, startJob, stopJob, removeJob } = useJobManager({
    jobType: "synthesize",
    messagePrefix: "synthesize",
    platformFolder,
    autoStartKey: AUTO_START_KEY,
    onJobSucceeded,
    onSwEvent,
  })

  const { synthesizingPaths, pendingSynthesizePaths, synthesizeFailedPaths, jobIdByPath } = useMemo(() => {
    const synthesizingPaths = new Set<string>()
    const pendingSynthesizePaths = new Set<string>()
    const synthesizeFailedPaths = new Set<string>()
    const jobIdByPath = new Map<string, string>()
    for (const r of jobRecords) {
      if (r.type !== "synthesize") continue
      let mediaPath = ""
      let videoPath = ""
      try {
        const d = JSON.parse(r.data || "{}") as { mediaPath?: string; videoPath?: string }
        if (d.mediaPath?.trim()) mediaPath = Path.posix(d.mediaPath.trim())
        if (d.videoPath?.trim()) videoPath = Path.posix(d.videoPath.trim())
      } catch {
        continue
      }
      const statusKey = mediaPath || videoPath
      if (!statusKey) continue
      jobIdByPath.set(statusKey, r.id)
      if (r.status === "running") synthesizingPaths.add(statusKey)
      if (r.status === "pending") pendingSynthesizePaths.add(statusKey)
      if (r.status === "failed") synthesizeFailedPaths.add(statusKey)
    }
    return { synthesizingPaths, pendingSynthesizePaths, synthesizeFailedPaths, jobIdByPath }
  }, [jobRecords])

  return {
    jobRecords,
    hasRunningSynthesize: hasRunningJob,
    startSynthesize: startJob,
    stopSynthesize: stopJob,
    removeSynthesize: removeJob,
    synthesizingPaths,
    pendingSynthesizePaths,
    synthesizeFailedPaths,
    jobIdByPath,
  }
}
