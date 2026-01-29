import { CheckCircle2, XCircle, Clock, StopCircle } from 'lucide-react';
import { useBackgroundJobs } from './BackgroundJobsProvider';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import type { JobStatus } from '@/types/background-jobs';
import { cn } from '@/lib/utils';

export function BackgroundJobsPopoverContent() {
  const context = useBackgroundJobs();

  // If context is not available, don't render
  if (!context) {
    return null;
  }

  const { jobs, abortJob } = context;

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

  return (
    <>
      <div className="p-4 border-b border-border">
        <h3 className="text-sm font-semibold">Background Jobs</h3>
        <p className="text-xs text-muted-foreground mt-1">
           {jobs.filter(j => j.status === 'running').length} running,
          {jobs.filter(j => j.status === 'pending').length} pending
        </p>
      </div>

      <div className="max-h-80 overflow-y-auto">
        {jobs.length === 0 ? (
          <div className="p-4 text-center text-sm text-muted-foreground">
            No background jobs
          </div>
        ) : (
          jobs.map((job) => (
            <div
              key={job.id}
              className="p-4 border-b border-border last:border-0 hover:bg-accent/50 transition-colors"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <span className={cn('text-xs font-medium', getStatusColor(job.status))}>
                      {getStatusIcon(job.status)}
                    </span>
                    <h4 className="text-sm font-medium truncate">{job.name}</h4>
                    <Badge variant={getStatusVariant(job.status)} className="text-xs">
                      {job.status}
                    </Badge>
                  </div>

                   {job.status === 'running' && (
                    <div className="space-y-1">
                      <Progress value={job.progress} className="h-1.5" />
                      <p className="text-xs text-muted-foreground">{Math.round(job.progress)}%</p>
                    </div>
                  )}

                   {job.status === 'succeeded' && (
                    <p className="text-xs text-muted-foreground">Completed successfully</p>
                  )}

                   {job.status === 'failed' && (
                    <p className="text-xs text-destructive">Job failed</p>
                  )}

                   {job.status === 'aborted' && (
                    <p className="text-xs text-muted-foreground">Aborted by user</p>
                  )}
                </div>

                 {job.status === 'running' && (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => abortJob(job.id)}
                    className="shrink-0"
                    aria-label={`Abort ${job.name}`}
                  >
                    <StopCircle className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </>
  );
}
