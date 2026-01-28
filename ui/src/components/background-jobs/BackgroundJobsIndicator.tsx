import { Activity } from 'lucide-react';
import { useBackgroundJobs } from './BackgroundJobsProvider';
import { BackgroundJobsPopoverContent } from './BackgroundJobsPopover';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

interface BackgroundJobsIndicatorProps {
  className?: string;
}

export function BackgroundJobsIndicator({ className }: BackgroundJobsIndicatorProps) {
  const context = useBackgroundJobs();

  // If context is not available (no provider), don't render
  if (!context) {
    return null;
  }

  const { getRunningJobs } = context;
  const runningJobs = getRunningJobs();

  // Don't render if no jobs are running
  if (runningJobs.length === 0) {
    return null;
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className={cn(
            'flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors',
            className
          )}
          aria-label={`View ${runningJobs.length} background ${runningJobs.length === 1 ? 'job' : 'jobs'}`}
        >
          <Activity className="h-4 w-4 animate-pulse" />
          <span className="text-xs">{runningJobs.length}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" side="top" className="w-80 p-0">
        <BackgroundJobsPopoverContent />
      </PopoverContent>
    </Popover>
  );
}
