import { Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import type { BackgroundJob } from '@/types/background-jobs'
import { useTranslation } from '@/lib/i18n'

export interface BackgroundJobsPopoverHeaderProps {
  jobs: BackgroundJob[]
  isLoading: boolean
  hasFailedCommands?: boolean
  removableCount: number
  onClear: () => void
}

export function BackgroundJobsPopoverHeader({
  jobs,
  isLoading,
  hasFailedCommands: _hasFailedCommands,
  removableCount,
  onClear,
}: BackgroundJobsPopoverHeaderProps) {
  const { t } = useTranslation('components')

  return (
    <div data-testid="background-jobs-header" className="p-4 border-b border-border">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <h3 data-testid="background-jobs-title" className="text-sm font-semibold">
            {t('statusBar.backgroundJobs.title')}
          </h3>
          <p data-testid="background-jobs-subtitle" className="text-xs text-muted-foreground mt-1">
            {t('statusBar.backgroundJobs.subtitle', {
              running: jobs.filter((j) => j.status === 'running').length,
              pending: jobs.filter((j) => j.status === 'pending').length,
            })}
          </p>
        </div>
        {!isLoading && removableCount > 0 && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                data-testid="background-jobs-clear-button"
                type="button"
                variant="ghost"
                size="sm"
                className="shrink-0 gap-1"
                aria-label={t('statusBar.backgroundJobs.clearFinishedAria')}
                onClick={onClear}
              >
                <Trash2 className="h-4 w-4" />
                {t('statusBar.backgroundJobs.clearFinished')}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>{t('statusBar.backgroundJobs.clearFinishedTooltip')}</p>
            </TooltipContent>
          </Tooltip>
        )}
      </div>
    </div>
  )
}
