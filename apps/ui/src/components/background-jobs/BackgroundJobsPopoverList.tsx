import { Loader2 } from 'lucide-react'
import { BackgroundJobItem } from './BackgroundJobItem'
import { useTranslation } from '@/lib/i18n'
import type { BackgroundJob } from '@/types/background-jobs'

export interface BackgroundJobsPopoverListProps {
  jobs: BackgroundJob[]
  isLoading: boolean
  stopJob: (id: string) => void
  removeJob: (id: string) => Promise<void>
  openLogDialog: (params: {
    executionId: string
    jobTitle: string
    isRunning: boolean
  }) => void
  stopAllJobs: () => Promise<void>
}

export function BackgroundJobsPopoverList({
  jobs,
  isLoading,
  stopJob,
  removeJob,
  openLogDialog,
  stopAllJobs,
}: BackgroundJobsPopoverListProps) {
  const { t } = useTranslation('components')

  return (
    <div data-testid="background-jobs-list" className="max-h-80 overflow-y-auto">
      {isLoading ? (
        <div
          data-testid="background-jobs-loading"
          className="flex items-center justify-center gap-2 p-6 text-sm text-muted-foreground"
        >
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>{t('statusBar.backgroundJobs.loading', { defaultValue: 'Loading\u2026' })}</span>
        </div>
      ) : jobs.length === 0 ? (
        <div
          data-testid="background-jobs-empty"
          className="p-4 text-center text-sm text-muted-foreground"
        >
          {t('statusBar.backgroundJobs.empty')}
        </div>
      ) : (
        jobs.map((job) => (
          <BackgroundJobItem
            key={job.id}
            job={job}
            stopJob={stopJob}
            removeJob={removeJob}
            openLogDialog={openLogDialog}
            stopAllJobs={stopAllJobs}
          />
        ))
      )}
    </div>
  )
}
