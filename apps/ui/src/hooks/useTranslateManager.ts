import { useMemo, useCallback, useRef } from 'react'
import { Path } from '@core/path'
import { toast } from 'sonner'
import { useJobManager } from '@/hooks/useJobManager'
import { useTranslation } from '@/lib/i18n'

const AUTO_START_KEY = 'translate.autoStart'

export interface UseTranslateManagerOptions {
  platformFolder: string | undefined
  onJobSucceeded?: () => void
}

export function useTranslateManager({ platformFolder, onJobSucceeded }: UseTranslateManagerOptions) {
  const { t } = useTranslation('components')
  const tRef = useRef(t)
  tRef.current = t

  const onSwEvent = useCallback((event: string, _jobId: string) => {
    const tr = tRef.current
    if (event === 'translate:started') {
      toast.info(tr('subtitleTranslationDialog.toastStart'))
    } else if (event === 'translate:succeeded') {
      toast.success(tr('subtitleTranslationDialog.toastSucceeded'))
    } else if (event === 'translate:failed') {
      toast.error(tr('subtitleTranslationDialog.toastFailed'))
    }
  }, [])

  const { jobRecords, hasRunningJob, startJob, stopJob, removeJob } = useJobManager({
    jobType: 'translate',
    messagePrefix: 'translate',
    platformFolder,
    autoStartKey: AUTO_START_KEY,
    onJobSucceeded,
    onSwEvent,
  })

  const { translatingPaths, pendingTranslatePaths, translateFailedPaths, jobIdByPath } =
    useMemo(() => {
      const translatingPaths = new Set<string>()
      const pendingTranslatePaths = new Set<string>()
      const translateFailedPaths = new Set<string>()
      const jobIdByPath = new Map<string, string>()
      for (const r of jobRecords) {
        if (r.type !== 'translate') continue
        let mediaPath = ''
        let subtitlePath = ''
        try {
          const d = JSON.parse(r.data || '{}') as { mediaPath?: string; subtitlePath?: string }
          if (d.mediaPath?.trim()) mediaPath = Path.posix(d.mediaPath.trim())
          subtitlePath = d.subtitlePath ? Path.posix(d.subtitlePath) : ''
        } catch {
          continue
        }
        const statusKey = mediaPath || subtitlePath
        if (!statusKey) continue
        jobIdByPath.set(statusKey, r.id)
        if (r.status === 'running') translatingPaths.add(statusKey)
        if (r.status === 'pending') pendingTranslatePaths.add(statusKey)
        if (r.status === 'failed') translateFailedPaths.add(statusKey)
      }
      return { translatingPaths, pendingTranslatePaths, translateFailedPaths, jobIdByPath }
    }, [jobRecords])

  return {
    jobRecords,
    hasRunningTranslate: hasRunningJob,
    startTranslate: startJob,
    stopTranslate: stopJob,
    removeTranslate: removeJob,
    translatingPaths,
    pendingTranslatePaths,
    translateFailedPaths,
    jobIdByPath,
  }
}
