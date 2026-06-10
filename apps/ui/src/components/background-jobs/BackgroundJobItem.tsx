import {
  CheckCircle2,
  XCircle,
  Clock,
  StopCircle,
  FileText,
} from 'lucide-react'
import { isJobRemovable } from '@/lib/backgroundJobLifecycle'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu'
import type { BackgroundJob, JobStatus } from '@/types/background-jobs'
import { isDownloadVideoJob, isFfmpegConvertBackgroundJob } from '@/types/background-jobs'
import { cn } from '@/lib/utils'
import type { TFunction } from 'i18next'
import { useTranslation } from '@/lib/i18n'
import { canOpenCommandLog, getJobExecutionId } from './backgroundJobsPopoverJobUtils'
import { useYtdlpDownloadProgressQuery } from '@/hooks/useYtdlpDownloadProgressQuery'
import { useFfmpegProgressQuery } from '@/hooks/useFfmpegProgressQuery'

function formatDownloadSpeed(bytesPerSecond: number): string {
  if (!Number.isFinite(bytesPerSecond) || bytesPerSecond <= 0) return '0 B/s'
  if (bytesPerSecond >= 1_000_000) {
    return `${(bytesPerSecond / 1_000_000).toFixed(1)} MB/s`
  }
  if (bytesPerSecond >= 1_000) {
    return `${(bytesPerSecond / 1_000).toFixed(0)} KB/s`
  }
  return `${bytesPerSecond} B/s`
}

function formatEta(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return ''
  if (seconds === 0) return '0s'
  if (seconds < 60) return `${Math.max(1, Math.ceil(seconds))}s`
  const totalSec = Math.ceil(seconds)
  const hours = Math.floor(totalSec / 3600)
  const minutes = Math.floor((totalSec % 3600) / 60)
  const secs = totalSec % 60
  if (hours > 0) {
    return `${hours}h ${minutes}m`
  }
  return `${minutes}m ${secs}s`
}

function getStatusIcon(status: JobStatus) {
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
    case 'stopped':
      return <StopCircle className="h-3 w-3" />
  }
}

function getStatusVariant(status: JobStatus) {
  switch (status) {
    case 'pending':
      return 'outline' as const
    case 'running':
      return 'default' as const
    case 'succeeded':
      return 'outline' as const
    case 'failed':
      return 'destructive' as const
    case 'aborted':
    case 'stopped':
      return 'secondary' as const
  }
}

function getStatusColor(status: JobStatus) {
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
    case 'stopped':
      return 'text-gray-600 dark:text-gray-400'
  }
}

function getJobDisplayName(job: BackgroundJob, t: TFunction<'components'>): string {
  switch (job.type) {
    case 'download-video': {
      const videos = (job.data as { videos?: unknown[] } | undefined)?.videos
      if (videos && videos.length > 1) {
        return t('statusBar.backgroundJobs.jobNames.downloadVideoEpisodes', { count: videos.length })
      }
      if (videos && videos.length === 1) {
        const v = videos[0] as { title?: string; url?: string }
        if (v?.title && v.title !== 'Download Video') return v.title
        if (v?.url) return v.url
      }
      return t('statusBar.backgroundJobs.jobNames.downloadVideo')
    }
    case 'transcribe':
    case 'translate':
    case 'synthesize':
    case 'process':
    case 'ffmpeg-convert':
    case 'ffmpeg-write-tags': {
      const typeLabel = t(`statusBar.backgroundJobs.jobNames.${job.type}`)
      const detail = job.name.includes(': ') ? job.name.slice(job.name.indexOf(': ') + 2) : null
      if (detail) {
        return t('statusBar.backgroundJobs.jobNames.typedJob', { type: typeLabel, detail })
      }
      return typeLabel
    }
    default:
      return job.name
  }
}

export interface BackgroundJobItemProps {
  job: BackgroundJob
  stopJob: (id: string) => void
  removeJob: (id: string) => Promise<void>
  openLogDialog: (params: {
    executionId: string
    jobTitle: string
    isRunning: boolean
  }) => void
  /**
   * Abort every pending and running job in the popover. Invoked from
   * the context-menu "Stop All" item — see `docs/design/background-jobs-stop-all.md`
   * for the two-phase ordering rationale.
   */
  stopAllJobs: () => Promise<void>
}

export function BackgroundJobItem({
  job,
  stopJob,
  removeJob,
  openLogDialog,
  stopAllJobs,
}: BackgroundJobItemProps) {
  const { t } = useTranslation('components')
  const displayName = getJobDisplayName(job, t)

  // For jobs with command logs, poll the log for real-time progress.
  // Single source of truth: main.log. IDB never holds transient fields.
  // - download-video → yt-dlp progress JSON
  // - ffmpeg-convert  → ffmpeg `frame=… time=…` lines (see
  //                     docs/design/ffmpeg-progress-display.md)
  const isDownload = isDownloadVideoJob(job)
  const isFfmpegConvert = isFfmpegConvertBackgroundJob(job)
  const executionId = getJobExecutionId(job) ?? ''
  const isJobRunning = job.status === 'running'
  const shouldPollLog = isJobRunning && (isDownload || isFfmpegConvert) && executionId.length > 0
  const { progress: ytdlpLiveProgress } = useYtdlpDownloadProgressQuery({
    executionId,
    isRunning: shouldPollLog && isDownload,
  })
  const { progress: ffmpegLiveProgress } = useFfmpegProgressQuery({
    executionId,
    isRunning: shouldPollLog && isFfmpegConvert,
  })

  // Live percent comes from the appropriate log-poll hook. Falls back to
  // IDB's overall progress before the first progress line lands.
  const livePercent =
    isDownload
      ? ytdlpLiveProgress?.percent
      : isFfmpegConvert
        ? ffmpegLiveProgress?.percent ?? undefined
        : undefined
  const overallPercent = Math.max(0, Math.min(100, job.progress))
  const percent = livePercent ?? overallPercent
  const speedBps = isDownload ? ytdlpLiveProgress?.speedBps : undefined
  const etaSeconds =
    isDownload
      ? ytdlpLiveProgress?.etaSeconds ?? undefined
      : isFfmpegConvert
        ? ffmpegLiveProgress?.etaSeconds ?? undefined
        : undefined

  return (
    <ContextMenu>
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
                  {t(`statusBar.backgroundJobs.status.${job.status}`)}
                </Badge>
              </div>

              {job.status === 'running' && (
                <div data-testid={`background-job-${job.id}-progress`} className="space-y-1">
                  <Progress value={percent} className="h-1.5" />
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs text-muted-foreground">{Math.round(percent)}%</p>
                    {isDownload && speedBps != null && (
                      <p
                        data-testid={`background-job-${job.id}-speed`}
                        className="text-xs text-muted-foreground"
                      >
                        {formatDownloadSpeed(speedBps)}
                      </p>
                    )}
                    {(isDownload || isFfmpegConvert) && etaSeconds != null && (
                      <p
                        data-testid={`background-job-${job.id}-eta`}
                        className="text-xs text-muted-foreground"
                      >
                        {formatEta(etaSeconds)}
                      </p>
                    )}
                  </div>
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
                    const id = getJobExecutionId(job)
                    if (!id) return
                    openLogDialog({
                      executionId: id,
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
          data-testid={`background-job-${job.id}-stop-all-menu`}
          onSelect={() => void stopAllJobs()}
        >
          {t('statusBar.backgroundJobs.stopAll')}
        </ContextMenuItem>
        <ContextMenuSeparator data-testid={`background-job-${job.id}-menu-separator`} />
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
}
