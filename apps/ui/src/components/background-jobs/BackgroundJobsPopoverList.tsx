import { CheckCircle2, XCircle, Clock, StopCircle, FileText, Loader2 } from 'lucide-react'
import { isJobRemovable } from '@/lib/backgroundJobLifecycle'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from '@/components/ui/context-menu'
import type { BackgroundJob, DownloadVideoJobVideo, JobStatus } from '@/types/background-jobs'
import { cn } from '@/lib/utils'
import { useTranslation } from '@/lib/i18n'
import { canOpenCommandLog, getJobExecutionId } from './backgroundJobsPopoverJobUtils'

function parseJobNameDetail(name: string): string | null {
  const idx = name.indexOf(': ')
  if (idx === -1) return null
  return name.slice(idx + 2)
}

type JobTypeLabelKey = 'transcribe' | 'translate' | 'synthesize' | 'process'

function getJobDisplayName(
  job: BackgroundJob,
  t: (key: string, options?: Record<string, unknown>) => string,
): string {
  switch (job.type) {
    case 'download-video': {
      const videos = (job.data as { videos?: DownloadVideoJobVideo[] } | undefined)?.videos
      if (videos && videos.length > 1) {
        return t('statusBar.backgroundJobs.jobNames.downloadVideoEpisodes', { count: videos.length })
      }
      if (videos && videos.length === 1) {
        const title = videos[0].title
        if (title && title !== 'Download Video') {
          return title
        }
        if (videos[0].url) {
          return videos[0].url
        }
      }
      return t('statusBar.backgroundJobs.jobNames.downloadVideo')
    }
    case 'transcribe':
    case 'translate':
    case 'synthesize':
    case 'process': {
      const typeLabel = t(`statusBar.backgroundJobs.jobNames.${job.type}` as `statusBar.backgroundJobs.jobNames.${JobTypeLabelKey}`)
      const detail = parseJobNameDetail(job.name)
      if (detail) {
        return t('statusBar.backgroundJobs.jobNames.typedJob', { type: typeLabel, detail })
      }
      return typeLabel
    }
    default:
      return job.name
  }
}

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
}

export function BackgroundJobsPopoverList({
  jobs,
  isLoading,
  stopJob,
  removeJob,
  openLogDialog,
}: BackgroundJobsPopoverListProps) {
  const { t } = useTranslation('components')
  const td = t as unknown as (key: string, options?: Record<string, unknown>) => string

  const getStatusIcon = (status: JobStatus) => {
    switch (status) {
      case 'pending':
        return <Clock className="h-3 w-3" />
      case 'running':
        return (
          <div className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
        )
      case 'succeeded':
        return <CheckCircle2 className="h-3 w-3" />
      case 'failed':
        return <XCircle className="h-3 w-3" />
      case 'aborted':
        return <StopCircle className="h-3 w-3" />
    }
  }

  const getStatusVariant = (status: JobStatus) => {
    switch (status) {
      case 'pending':
        return 'outline'
      case 'running':
        return 'default'
      case 'succeeded':
        return 'outline'
      case 'failed':
        return 'destructive'
      case 'aborted':
        return 'secondary'
    }
  }

  const getStatusColor = (status: JobStatus) => {
    switch (status) {
      case 'pending':
        return 'text-yellow-600 dark:text-yellow-400'
      case 'running':
        return 'text-blue-600 dark:text-blue-400'
      case 'succeeded':
        return 'text-green-600 dark:text-green-400'
      case 'failed':
        return 'text-red-600 dark:text-red-400'
      case 'aborted':
        return 'text-gray-600 dark:text-gray-400'
    }
  }

  const getStatusText = (status: JobStatus) => {
    switch (status) {
      case 'pending':
        return t('statusBar.backgroundJobs.status.pending')
      case 'running':
        return t('statusBar.backgroundJobs.status.running')
      case 'succeeded':
        return t('statusBar.backgroundJobs.status.succeeded')
      case 'failed':
        return t('statusBar.backgroundJobs.status.failed')
      case 'aborted':
        return t('statusBar.backgroundJobs.status.aborted')
    }
  }

  return (
    <div data-testid="background-jobs-list" className="max-h-80 overflow-y-auto">
      {isLoading ? (
        <div
          data-testid="background-jobs-loading"
          className="flex items-center justify-center gap-2 p-6 text-sm text-muted-foreground"
        >
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>{t('statusBar.backgroundJobs.loading', { defaultValue: 'Loading…' })}</span>
        </div>
      ) : jobs.length === 0 ? (
        <div
          data-testid="background-jobs-empty"
          className="p-4 text-center text-sm text-muted-foreground"
        >
          {t('statusBar.backgroundJobs.empty')}
        </div>
      ) : (
        jobs.map((job) => {
          const displayName = getJobDisplayName(job, td)
          return (
          <ContextMenu key={job.id}>
            <ContextMenuTrigger asChild>
              <div
                data-testid={`background-job-${job.id}`}
                className="p-4 border-b border-border last:border-0 hover:bg-accent/50 transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <span
                        data-testid={`background-job-${job.id}-status-icon`}
                        className={cn('text-xs font-medium', getStatusColor(job.status))}
                      >
                        {getStatusIcon(job.status)}
                      </span>
                      <h4
                        data-testid={`background-job-${job.id}-name`}
                        className="text-sm font-medium truncate"
                        title={displayName}
                      >
                        {displayName}
                      </h4>
                      <Badge
                        data-testid={`background-job-${job.id}-status-badge`}
                        variant={getStatusVariant(job.status)}
                        className="text-xs"
                      >
                        {getStatusText(job.status)}
                      </Badge>
                    </div>

                    {job.status === 'running' && (
                      <div data-testid={`background-job-${job.id}-progress`} className="space-y-1">
                        <Progress value={job.progress} className="h-1.5" />
                        <p className="text-xs text-muted-foreground">{Math.round(job.progress)}%</p>
                      </div>
                    )}

                    {job.status === 'succeeded' && (
                      <p
                        data-testid={`background-job-${job.id}-message`}
                        className="text-xs text-muted-foreground"
                      >
                        {t('statusBar.backgroundJobs.messages.succeeded')}
                      </p>
                    )}

                    {job.status === 'failed' && (
                      <p
                        data-testid={`background-job-${job.id}-message`}
                        className="text-xs text-destructive"
                      >
                        {t('statusBar.backgroundJobs.messages.failed')}
                      </p>
                    )}

                    {job.status === 'aborted' && (
                      <p
                        data-testid={`background-job-${job.id}-message`}
                        className="text-xs text-muted-foreground"
                      >
                        {t('statusBar.backgroundJobs.messages.aborted')}
                      </p>
                    )}
                  </div>

                  <div className="flex shrink-0 flex-col items-end gap-2">
                    {canOpenCommandLog(job) && (
                      <Button
                        data-testid={`background-job-${job.id}-log-button`}
                        type="button"
                        variant="outline"
                        size="sm"
                        className="gap-1"
                        aria-label={t('statusBar.backgroundJobs.logButtonAria', { name: displayName })}
                        onClick={() => {
                          const executionId = getJobExecutionId(job)
                          if (!executionId) return
                          openLogDialog({
                            executionId,
                            jobTitle: displayName,
                            isRunning: job.status === 'running',
                          })
                        }}
                      >
                        <FileText className="h-4 w-4" />
                        {t('statusBar.backgroundJobs.logButton')}
                      </Button>
                    )}
                    {job.status === 'running' && (
                      <Button
                        data-testid={`background-job-${job.id}-abort-button`}
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => stopJob(job.id)}
                        aria-label={t('statusBar.backgroundJobs.abortAriaLabel', { name: displayName })}
                      >
                        <StopCircle className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </ContextMenuTrigger>
            <ContextMenuContent>
              <ContextMenuItem
                data-testid={`background-job-${job.id}-delete-menu`}
                variant="destructive"
                disabled={!isJobRemovable(job.status)}
                title={
                  !isJobRemovable(job.status)
                    ? t('statusBar.backgroundJobs.deleteDisabledRunning')
                    : undefined
                }
                onSelect={() => void removeJob(job.id)}
              >
                {t('statusBar.backgroundJobs.delete')}
              </ContextMenuItem>
            </ContextMenuContent>
          </ContextMenu>
        )
      })
      )}
    </div>
  )
}
