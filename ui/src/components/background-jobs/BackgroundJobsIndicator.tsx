import { Loader2, CircleCheck } from 'lucide-react';
import { useBackgroundJobs } from './BackgroundJobsProvider';
import { BackgroundJobsPopoverContent } from './BackgroundJobsPopover';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { JobStatus } from '@/types/background-jobs';

interface BackgroundJobsIndicatorProps {
  className?: string;
}

export function BackgroundJobsIndicator({ className }: BackgroundJobsIndicatorProps) {
  const context = useBackgroundJobs();

  // If context is not available (no provider), don't render
  if (!context) {
    return null;
  }

  const { getRunningJobs, jobs, isPopoverOpen, setPopoverOpen } = context;
  const runningJobs = getRunningJobs();

  // Don't render if no jobs at all (or only completed/failed jobs)
  const activeJobs = jobs.filter(j => j.status === JobStatus.RUNNING || j.status === JobStatus.PENDING);
  if (jobs.length === 0 || activeJobs.length === 0) {
    return null;
  }

  const isRunning = runningJobs.length > 0;

  return (
    <Popover open={isPopoverOpen} onOpenChange={setPopoverOpen}>
      <PopoverTrigger asChild>
        <button
          className={cn(
            'flex items-center gap-2 text-muted-foreground hover:text-foreground transition-all duration-200',
            className
          )}
          aria-label={`View ${runningJobs.length} background ${runningJobs.length === 1 ? 'job' : 'jobs'}`}
        >
          {isRunning ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
              <span className="text-xs font-medium text-blue-500">{runningJobs.length}</span>
            </>
          ) : (
            <>
              <CircleCheck className="h-4 w-4 text-green-500" />
              <span className="text-xs font-medium text-green-500">{activeJobs.length}</span>
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
