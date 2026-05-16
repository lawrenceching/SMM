import { useEffect, useState } from 'react';
import { CheckCircle2, XCircle, Clock, StopCircle, FileText, Loader2 } from 'lucide-react';
import { useJobManager } from '@/hooks/useJobManager';
import { useStatusbarStore } from '@/stores/statusbarStore';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import type { BackgroundJob, JobStatus } from '@/types/background-jobs';
import {
  isDownloadVideoJob,
  isProcessBackgroundJob,
  isSynthesizeBackgroundJob,
  isTranscribeBackgroundJob,
  isTranslateBackgroundJob,
} from '@/types/background-jobs';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/lib/i18n';
import { useDialogs } from '@/providers/dialog-provider';

function getJobExecutionId(job: BackgroundJob): string | undefined {
  if (isTranscribeBackgroundJob(job)) return job.data.executionId
  if (isTranslateBackgroundJob(job)) return job.data.executionId
  if (isSynthesizeBackgroundJob(job)) return job.data.executionId
  if (isProcessBackgroundJob(job)) return job.data.executionId
  if (isDownloadVideoJob(job)) return job.data.executionId
  return undefined
}

function canOpenCommandLog(job: BackgroundJob): boolean {
  if (
    !isTranscribeBackgroundJob(job) &&
    !isTranslateBackgroundJob(job) &&
    !isSynthesizeBackgroundJob(job) &&
    !isProcessBackgroundJob(job) &&
    !isDownloadVideoJob(job)
  ) {
    return false
  }
  const id = getJobExecutionId(job)
  return typeof id === 'string' && id.length > 0
}

export function BackgroundJobsPopoverContent() {
  const { t } = useTranslation("components")
  const { jobs, stopJob, refreshFromIndexedDB } = useJobManager()
  const isPopoverOpen = useStatusbarStore((s) => s.isBackgroundJobsPopoverOpen)
  const { logDialog } = useDialogs();
  const [openLogDialog] = logDialog;
  const [isLoading, setIsLoading] = useState(() => jobs.length === 0)

  useEffect(() => {
    if (!isPopoverOpen) return
    if (jobs.length > 0) {
      setIsLoading(false)
      return
    }
    setIsLoading(true)
    void refreshFromIndexedDB('popover-mount').finally(() => setIsLoading(false))
  }, [isPopoverOpen, jobs.length, refreshFromIndexedDB])

   const getStatusIcon = (status: JobStatus) => {
    switch (status) {
      case 'pending':
        return <Clock className="h-3 w-3" />;
      case 'running':
        return <div className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />;
      case 'succeeded':
        return <CheckCircle2 className="h-3 w-3" />;
      case 'failed':
        return <XCircle className="h-3 w-3" />;
      case 'aborted':
        return <StopCircle className="h-3 w-3" />;
    }
  };

   const getStatusVariant = (status: JobStatus) => {
    switch (status) {
      case 'pending':
        return 'outline';
      case 'running':
        return 'default';
      case 'succeeded':
        return 'outline';
      case 'failed':
        return 'destructive';
      case 'aborted':
        return 'secondary';
    }
  };

   const getStatusColor = (status: JobStatus) => {
    switch (status) {
      case 'pending':
        return 'text-yellow-600 dark:text-yellow-400';
      case 'running':
        return 'text-blue-600 dark:text-blue-400';
      case 'succeeded':
        return 'text-green-600 dark:text-green-400';
      case 'failed':
        return 'text-red-600 dark:text-red-400';
      case 'aborted':
        return 'text-gray-600 dark:text-gray-400';
    }
  };

  const getStatusText = (status: JobStatus) => {
    switch (status) {
      case 'pending':
        return t("statusBar.backgroundJobs.status.pending");
      case 'running':
        return t("statusBar.backgroundJobs.status.running");
      case 'succeeded':
        return t("statusBar.backgroundJobs.status.succeeded");
      case 'failed':
        return t("statusBar.backgroundJobs.status.failed");
      case 'aborted':
        return t("statusBar.backgroundJobs.status.aborted");
    }
  };

  return (
    <>
      <div data-testid="background-jobs-header" className="p-4 border-b border-border">
        <h3 data-testid="background-jobs-title" className="text-sm font-semibold">{t("statusBar.backgroundJobs.title")}</h3>
        <p data-testid="background-jobs-subtitle" className="text-xs text-muted-foreground mt-1">
          {t("statusBar.backgroundJobs.subtitle", {
            running: jobs.filter(j => j.status === 'running').length,
            pending: jobs.filter(j => j.status === 'pending').length,
          })}
        </p>
      </div>

      <div data-testid="background-jobs-list" className="max-h-80 overflow-y-auto">
        {isLoading ? (
          <div
            data-testid="background-jobs-loading"
            className="flex items-center justify-center gap-2 p-6 text-sm text-muted-foreground"
          >
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>{t("statusBar.backgroundJobs.loading", { defaultValue: "Loading…" })}</span>
          </div>
        ) : jobs.length === 0 ? (
          <div data-testid="background-jobs-empty" className="p-4 text-center text-sm text-muted-foreground">
            {t("statusBar.backgroundJobs.empty")}
          </div>
        ) : (
          jobs.map((job) => (
            <div
              key={job.id}
              data-testid={`background-job-${job.id}`}
              className="p-4 border-b border-border last:border-0 hover:bg-accent/50 transition-colors"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <span data-testid={`background-job-${job.id}-status-icon`} className={cn('text-xs font-medium', getStatusColor(job.status))}>
                      {getStatusIcon(job.status)}
                    </span>
                    <h4 data-testid={`background-job-${job.id}-name`} className="text-sm font-medium truncate">{job.name}</h4>
                    <Badge data-testid={`background-job-${job.id}-status-badge`} variant={getStatusVariant(job.status)} className="text-xs">
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
                    <p data-testid={`background-job-${job.id}-message`} className="text-xs text-muted-foreground">{t("statusBar.backgroundJobs.messages.succeeded")}</p>
                  )}

                   {job.status === 'failed' && (
                    <p data-testid={`background-job-${job.id}-message`} className="text-xs text-destructive">{t("statusBar.backgroundJobs.messages.failed")}</p>
                  )}

                   {job.status === 'aborted' && (
                    <p data-testid={`background-job-${job.id}-message`} className="text-xs text-muted-foreground">{t("statusBar.backgroundJobs.messages.aborted")}</p>
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
                      aria-label={t("statusBar.backgroundJobs.logButtonAria", { name: job.name })}
                      onClick={() => {
                        const executionId = getJobExecutionId(job)
                        if (!executionId) return
                        openLogDialog({
                          executionId,
                          jobTitle: job.name,
                          isRunning: job.status === 'running',
                        })
                      }}
                    >
                      <FileText className="h-4 w-4" />
                      {t("statusBar.backgroundJobs.logButton")}
                    </Button>
                  )}
                  {job.status === 'running' && (
                    <Button
                      data-testid={`background-job-${job.id}-abort-button`}
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => stopJob(job.id)}
                      aria-label={t("statusBar.backgroundJobs.abortAriaLabel", { name: job.name })}
                    >
                      <StopCircle className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </>
  );
}
