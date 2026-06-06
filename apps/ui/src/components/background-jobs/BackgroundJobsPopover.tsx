import { Loader2, CircleAlert, CircleCheck } from 'lucide-react';
import { useBackgroundJobsIndicator } from '../hooks/useBackgroundJobsIndicator';
import { BackgroundJobsPopoverContent } from './BackgroundJobsPopoverContent';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/lib/i18n';

interface BackgroundJobsPopoverProps {
  className?: string;
}

export function BackgroundJobsPopover({ className }: BackgroundJobsPopoverProps) {
  const { t } = useTranslation("components")
  const {
    shouldRender,
    statusVariant,
    isPopoverOpen,
    setPopoverOpen,
    runningCount,
    activeCount,
  } = useBackgroundJobsIndicator()

  if (!shouldRender) {
    return null;
  }

  return (
    <Popover open={isPopoverOpen} onOpenChange={setPopoverOpen}>
      <PopoverTrigger asChild>
        <button
          data-testid="background-jobs-trigger-button"
          className={cn(
            'flex items-center gap-2 text-muted-foreground hover:text-foreground transition-all duration-200',
            className
          )}
          aria-label={t("statusBar.backgroundJobs.triggerAriaLabel", { count: activeCount })}
        >
          {statusVariant === 'running' ? (
            <>
              <Loader2 data-testid="background-jobs-loading-icon" className="h-4 w-4 animate-spin text-blue-500" />
              <span data-testid="background-jobs-count" className="text-xs font-medium text-blue-500">{runningCount}</span>
            </>
          ) : statusVariant === 'warning' ? (
            <>
              <CircleAlert data-testid="background-jobs-warning-icon" className="h-4 w-4 text-yellow-500" />
              <span data-testid="background-jobs-count" className="text-xs font-medium text-yellow-500">{activeCount}</span>
            </>
          ) : (
            <>
              <CircleCheck data-testid="background-jobs-completed-icon" className="h-4 w-4 text-green-500" />
              <span data-testid="background-jobs-count" className="text-xs font-medium text-green-500">{activeCount}</span>
            </>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" side="top" className="w-80 p-0 max-h-[80vh] flex flex-col">
        <BackgroundJobsPopoverContent />
      </PopoverContent>
    </Popover>
  );
}
