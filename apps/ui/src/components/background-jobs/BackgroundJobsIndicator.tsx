import { Loader2, CircleCheck } from 'lucide-react';
import { useBackgroundJobsIndicator } from '../hooks/useBackgroundJobsIndicator';
import { BackgroundJobsPopoverContent } from './BackgroundJobsPopover';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { cn } from '@/lib/utils';


interface BackgroundJobsIndicatorProps {
  className?: string;
}

export function BackgroundJobsIndicator({ className }: BackgroundJobsIndicatorProps) {
  const { 
    shouldRender, 
    isRunning, 
    isPopoverOpen, 
    setPopoverOpen,
    runningCount,
    activeCount 
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
          aria-label={`View ${runningCount} background ${runningCount === 1 ? 'job' : 'jobs'}`}
        >
          {isRunning ? (
            <>
              <Loader2 data-testid="background-jobs-loading-icon" className="h-4 w-4 animate-spin text-blue-500" />
              <span data-testid="background-jobs-count" className="text-xs font-medium text-blue-500">{runningCount}</span>
            </>
          ) : (
            <>
              <CircleCheck data-testid="background-jobs-completed-icon" className="h-4 w-4 text-green-500" />
              <span data-testid="background-jobs-count" className="text-xs font-medium text-green-500">{activeCount}</span>
            </>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" side="top" className="w-80 p-0">
        <BackgroundJobsPopoverContent />
      </PopoverContent>
    </Popover>
  );
}
