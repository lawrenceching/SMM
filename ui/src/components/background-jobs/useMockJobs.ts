import { useEffect } from 'react';
import { useBackgroundJobs } from './BackgroundJobsProvider';
import type { JobStatus } from '@/types/background-jobs';

export function useMockJobs() {
  const context = useBackgroundJobs();

  // If context is not available, don't run mock jobs
  if (!context) {
    return;
  }

  const { addJob, updateJob } = context;

  useEffect(() => {
    // Create a mock "Scanning Media Library" job
    const jobId = addJob('Scanning Media Library');

    // Simulate job starting
    setTimeout(() => {
      updateJob(jobId, { status: 'running' as JobStatus });
    }, 500);

    // Simulate progress updates
    let progress = 0;
    const interval = setInterval(() => {
      progress += Math.random() * 15 + 5; // Random increment between 5-20%
      if (progress >= 100) {
        progress = 100;
        clearInterval(interval);
        updateJob(jobId, {
          progress: 100,
          status: 'succeeded' as JobStatus,
        });
      } else {
        updateJob(jobId, { progress });
      }
    }, 1000); // Update every second

    return () => clearInterval(interval);
  }, [addJob, updateJob]);
}
