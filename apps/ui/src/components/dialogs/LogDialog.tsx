import { useEffect, useRef, useState } from 'react'
import { useCommandLogQuery } from '@/hooks/useCommandLogQuery'
import { useBackgroundJobsStore } from '@/stores/backgroundJobsStore'
import { getJobExecutionId } from '@/components/background-jobs/backgroundJobsPopoverJobUtils'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useTranslation } from '@/lib/i18n'
import { isTerminalCommandLogText } from '@/lib/commandLogTerminal'
import { Loader2, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'

export type LogDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  executionId: string
  jobTitle: string
  /** When true, poll the log endpoint while the job is still running. */
  isRunning?: boolean
}

export function LogDialog({
  open,
  onOpenChange,
  executionId,
  jobTitle,
  isRunning = false,
}: LogDialogProps) {
  const { t } = useTranslation('components')
  const [passiveEnded, setPassiveEnded] = useState(false)
  const jobForExecution = useBackgroundJobsStore((s) =>
    executionId ? s.jobs.find((j) => getJobExecutionId(j) === executionId) : undefined,
  )

  useEffect(() => {
    setPassiveEnded(false)
  }, [executionId, open])

  const jobStillRunning =
    jobForExecution != null
      ? jobForExecution.status === 'running'
      : isRunning

  const effectiveIsRunning = jobStillRunning && !passiveEnded

  const query = useCommandLogQuery({
    executionId,
    enabled: open && executionId.length > 0,
    isRunning: effectiveIsRunning,
  })

  const bodyText = query.data?.text ?? ''

  useEffect(() => {
    if (bodyText && isTerminalCommandLogText(bodyText)) {
      setPassiveEnded(true)
    }
  }, [bodyText])

  const truncated = query.data?.meta.truncated ?? false
  const logTextareaRef = useRef<HTMLTextAreaElement>(null)

  const handleDialogKeyDownCapture = (event: React.KeyboardEvent) => {
    if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== 'a') return
    if (!bodyText.trim()) return
    const textarea = logTextareaRef.current
    if (!textarea || event.target === textarea) return
    event.preventDefault()
    textarea.focus()
    textarea.select()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex max-w-3xl flex-col gap-0 overflow-hidden p-0"
        aria-describedby={undefined}
        onKeyDownCapture={handleDialogKeyDownCapture}
      >
        <DialogHeader className="min-w-0 shrink-0 border-b border-border px-4 py-3">
          <DialogTitle className="flex min-w-0 flex-wrap items-center gap-2 text-base">
            <span className="min-w-0 break-all">{t('statusBar.backgroundJobs.logDialog.title', { jobTitle })}</span>
            {effectiveIsRunning && (
              <span className="inline-flex items-center gap-1 rounded-md border border-border bg-muted/60 px-2 py-0.5 text-xs font-normal text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                {t('statusBar.backgroundJobs.logDialog.live')}
              </span>
            )}
          </DialogTitle>
        </DialogHeader>
        <div className="flex min-w-0 shrink-0 flex-wrap items-center gap-2 border-b border-border px-4 py-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 gap-1"
            onClick={() => void query.refetch()}
            disabled={query.isFetching}
          >
            {query.isFetching ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
            {t('statusBar.backgroundJobs.logDialog.refresh')}
          </Button>
        </div>
        {truncated && (
          <p className="min-w-0 shrink-0 border-b border-border bg-muted/50 px-4 py-2 text-xs text-muted-foreground">
            {t('statusBar.backgroundJobs.logDialog.truncated')}
          </p>
        )}
        <div className="min-w-0 overflow-hidden p-4">
          {query.isPending && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              {t('statusBar.backgroundJobs.logDialog.loading')}
            </div>
          )}
          {query.isError && (
            <p className="text-sm text-destructive">
              {t('statusBar.backgroundJobs.logDialog.loadError')}
            </p>
          )}
          {!query.isPending && !query.isError && !bodyText.trim() && (
            <p className="text-sm text-muted-foreground">{t('statusBar.backgroundJobs.logDialog.empty')}</p>
          )}
          {!query.isPending && !query.isError && bodyText.trim() !== '' && (
            <textarea
              ref={logTextareaRef}
              readOnly
              aria-label={t('statusBar.backgroundJobs.logDialog.contentAria')}
              value={bodyText}
              data-testid="log-dialog-content"
              className={cn(
                'h-[min(60vh,420px)] w-full min-w-0 max-w-full resize-none overflow-auto rounded-md border border-border bg-background p-3 text-xs font-mono leading-relaxed whitespace-pre-wrap break-all outline-none focus:border-border focus:outline-none focus-visible:border-border focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0',
              )}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
