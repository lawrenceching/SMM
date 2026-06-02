import { useEffect, useMemo, useState } from 'react'
import { useJobManager } from '@/hooks/useJobManager'
import { useStatusbarStore } from '@/stores/statusbarStore'
import { useFailedCommandLogsStore } from '@/stores/failedCommandLogsStore'
import { isJobRemovable } from '@/lib/backgroundJobLifecycle'
import { useDialogs } from '@/providers/dialog-provider'
import { BackgroundJobsPopoverHeader } from './BackgroundJobsPopoverHeader'
import { BackgroundJobsPopoverList } from './BackgroundJobsPopoverList'
import { FailedCommandsList } from './FailedCommandsList'

export function BackgroundJobsPopoverContent() {
  const { jobs, stopJob, removeJob, clearRemovableJobs, refreshFromIndexedDB } = useJobManager()
  const isPopoverOpen = useStatusbarStore((s) => s.isBackgroundJobsPopoverOpen)
  const { logDialog } = useDialogs()
  const [openLogDialog] = logDialog
  const [isLoading, setIsLoading] = useState(() => jobs.length === 0)
  const failedEntries = useFailedCommandLogsStore((s) => s.entries)
  const removeFailedEntry = useFailedCommandLogsStore((s) => s.removeEntry)

  const removableCount = useMemo(
    () => jobs.filter((j) => isJobRemovable(j.status)).length + failedEntries.length,
    [jobs, failedEntries],
  )

  const handleClearFailed = () => {
    useFailedCommandLogsStore.getState().clearAll()
  }

  useEffect(() => {
    if (!isPopoverOpen) return
    if (jobs.length > 0) {
      setIsLoading(false)
      return
    }
    setIsLoading(true)
    void refreshFromIndexedDB('popover-mount').finally(() => setIsLoading(false))
  }, [isPopoverOpen, jobs.length, refreshFromIndexedDB])

  return (
    <>
      <BackgroundJobsPopoverHeader
        jobs={jobs}
        isLoading={isLoading}
        hasFailedCommands={failedEntries.length > 0}
        removableCount={removableCount}
        onClear={() => {
          void clearRemovableJobs()
          handleClearFailed()
        }}
      />
      <BackgroundJobsPopoverList
        jobs={jobs}
        isLoading={isLoading}
        stopJob={stopJob}
        removeJob={removeJob}
        openLogDialog={openLogDialog}
      />
      {failedEntries.length > 0 && (
        <FailedCommandsList
          entries={failedEntries}
          onRemove={removeFailedEntry}
          openLogDialog={openLogDialog}
        />
      )}
    </>
  )
}
