import { useMemo } from 'react'
import { Path } from '@core/path'
import { useJobManager } from '@/hooks/useJobManager'

const AUTO_START_KEY = 'transcribe.autoStart'

export interface UseTranscribeManagerOptions {
  platformFolder: string | undefined
  onJobSucceeded?: () => void
}

export function useTranscribeManager({
  platformFolder,
  onJobSucceeded,
}: UseTranscribeManagerOptions) {
  const { jobRecords, hasRunningJob, startJob, stopJob, removeJob } = useJobManager({
    jobType: 'transcribe',
    messagePrefix: 'transcribe',
    platformFolder,
    autoStartKey: AUTO_START_KEY,
    onJobSucceeded,
  })

  const { transcribingPaths, pendingTranscribePaths, transcribeFailedPaths, jobIdByPath } =
    useMemo(() => {
      const transcribingPaths = new Set<string>()
      const pendingTranscribePaths = new Set<string>()
      const transcribeFailedPaths = new Set<string>()
      const jobIdByPath = new Map<string, string>()
      for (const r of jobRecords) {
        if (r.type !== 'transcribe') continue
        let mediaPath = ''
        try {
          const d = JSON.parse(r.data || '{}') as { mediaPath?: string }
          mediaPath = d.mediaPath ? Path.posix(d.mediaPath) : ''
        } catch {
          continue
        }
        if (!mediaPath) continue
        jobIdByPath.set(mediaPath, r.id)
        if (r.status === 'running') transcribingPaths.add(mediaPath)
        if (r.status === 'pending') pendingTranscribePaths.add(mediaPath)
        if (r.status === 'failed') transcribeFailedPaths.add(mediaPath)
      }
      return { transcribingPaths, pendingTranscribePaths, transcribeFailedPaths, jobIdByPath }
    }, [jobRecords])

  return {
    jobRecords,
    hasRunningTranscribe: hasRunningJob,
    startTranscribe: startJob,
    stopTranscribe: stopJob,
    removeTranscribe: removeJob,
    transcribingPaths,
    pendingTranscribePaths,
    transcribeFailedPaths,
    jobIdByPath,
  }
}
