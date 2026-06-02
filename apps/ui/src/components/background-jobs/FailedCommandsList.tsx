import { XCircle, FileText, X, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useTranslation } from '@/lib/i18n'
import type { FailedCommandLogEntry } from '@/stores/failedCommandLogsStore'

export interface FailedCommandsListProps {
  entries: FailedCommandLogEntry[]
  onRemove: (executionId: string) => void
  openLogDialog: (params: {
    executionId: string
    jobTitle: string
    isRunning: boolean
  }) => void
}

export function FailedCommandsList({
  entries,
  onRemove,
  openLogDialog,
}: FailedCommandsListProps) {
  const { t } = useTranslation('components')

  return (
    <div data-testid="failed-commands-list">
      <div className="px-4 py-2 text-xs font-semibold text-muted-foreground bg-muted/30 border-t border-border flex items-center gap-1.5">
        <AlertTriangle className="h-3 w-3 text-destructive" />
        {t('statusBar.backgroundJobs.failedCommands', 'Failed Commands')}
        <span className="ml-auto text-xs font-normal">({entries.length})</span>
      </div>
      {entries.map((entry) => (
        <div
          key={entry.executionId}
          data-testid={`failed-command-${entry.executionId}`}
          className="p-3 border-b border-border last:border-0 hover:bg-accent/50 transition-colors"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <XCircle className="h-3 w-3 text-destructive shrink-0" />
                <span className="text-xs font-medium text-destructive">
                  {entry.command}
                </span>
                <span className="text-xs text-muted-foreground truncate" title={entry.title}>
                  {entry.title}
                </span>
              </div>
              <p className="text-xs text-muted-foreground line-clamp-2">
                {entry.error}
              </p>
              <p className="text-xs text-muted-foreground/60 mt-0.5">
                {new Date(entry.timestamp).toLocaleTimeString()}
              </p>
            </div>
            <div className="flex shrink-0 gap-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1 h-7"
                aria-label={t('statusBar.backgroundJobs.logButtonAria', { name: entry.title })}
                onClick={() =>
                  openLogDialog({
                    executionId: entry.executionId,
                    jobTitle: entry.title,
                    isRunning: false,
                  })
                }
              >
                <FileText className="h-3 w-3" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="h-7 w-7"
                onClick={() => onRemove(entry.executionId)}
                aria-label={t('statusBar.backgroundJobs.removeLogEntry', 'Remove')}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
