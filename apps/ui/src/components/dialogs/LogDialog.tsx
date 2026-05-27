import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useBackgroundJobsStore } from '@/stores/backgroundJobsStore'
import { getJobExecutionId } from '@/components/background-jobs/backgroundJobsPopoverJobUtils'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useTranslation } from '@/lib/i18n'
import {
  fetchCommandLogRaw,
  fetchCommandLogSegments,
  type CommandLogFormat,
} from '@/api/commandLog'
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
  const [format, setFormat] = useState<CommandLogFormat>('raw')
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

  const query = useQuery({
    queryKey: ['command-log', executionId, format],
    enabled: open && executionId.length > 0,
    staleTime: effectiveIsRunning ? 0 : 60_000,
    refetchInterval: effectiveIsRunning ? 2000 : false,
    refetchOnWindowFocus: effectiveIsRunning,
    queryFn: async () => {
      if (format === 'raw') {
        return fetchCommandLogRaw(executionId)
      }
      const { body, meta } = await fetchCommandLogSegments(executionId)
      return { segments: body.segments, meta }
    },
  })

  const bodyText = useMemo(() => {
    if (!query.data) return ''
    if ('text' in query.data) return query.data.text
    return query.data.segments
      .map((s) => `[${s.kind}] ${s.ts}\n${s.body}`)
      .join('\n')
  }, [query.data])

  useEffect(() => {
    if (bodyText && isTerminalCommandLogText(bodyText)) {
      setPassiveEnded(true)
    }
  }, [bodyText])

  const truncated = query.data?.meta.truncated ?? false

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl gap-0 p-0" aria-describedby={undefined}>
        <DialogHeader className="border-b border-border px-4 py-3">
          <DialogTitle className="flex flex-wrap items-center gap-2 text-base">
            <span>{t('statusBar.backgroundJobs.logDialog.title', { jobTitle })}</span>
            {effectiveIsRunning && (
              <span className="inline-flex items-center gap-1 rounded-md border border-border bg-muted/60 px-2 py-0.5 text-xs font-normal text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                {t('statusBar.backgroundJobs.logDialog.live')}
              </span>
            )}
          </DialogTitle>
        </DialogHeader>
        <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-2">
          <div className="flex gap-1 rounded-md border border-border p-0.5">
            <Button
              type="button"
              size="sm"
              variant={format === 'raw' ? 'secondary' : 'ghost'}
              className="h-8 px-2"
              onClick={() => setFormat('raw')}
            >
              {t('statusBar.backgroundJobs.logDialog.raw')}
            </Button>
            <Button
              type="button"
              size="sm"
              variant={format === 'segments' ? 'secondary' : 'ghost'}
              className="h-8 px-2"
              onClick={() => setFormat('segments')}
            >
              {t('statusBar.backgroundJobs.logDialog.segments')}
            </Button>
          </div>
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
          <p className="border-b border-border bg-muted/50 px-4 py-2 text-xs text-muted-foreground">
            {t('statusBar.backgroundJobs.logDialog.truncated')}
          </p>
        )}
        <div className="p-4">
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
          {query.isSuccess && !bodyText.trim() && (
            <p className="text-sm text-muted-foreground">{t('statusBar.backgroundJobs.logDialog.empty')}</p>
          )}
          {query.isSuccess && bodyText.trim() !== '' && (
            <ScrollArea className={cn('h-[min(60vh,420px)] w-full rounded-md border border-border')}>
              <pre className="whitespace-pre-wrap wrap-break-word p-3 text-xs font-mono leading-relaxed">
                {bodyText}
              </pre>
            </ScrollArea>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
